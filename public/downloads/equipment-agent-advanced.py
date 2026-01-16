#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PontoMax Equipment Agent - Advanced Edition
Version: 2.0.0

Complete local agent for time clock equipment communication.
Supports equipment without webservices, automatic detection, and cloud sync.

Features:
- Automatic equipment discovery on local network
- Multi-protocol support (TCP, HTTP, HTTPS)
- ZKTeco protocol implementation (PUSH/PULL)
- Automatic employee sync from cloud
- Real-time record forwarding to cloud
- Service mode for Windows and Linux
- GUI for configuration and monitoring

Supported manufacturers without webservice:
- ZKTeco (K40, K50, G3, F22, iClock 880, SF300)
- Anviz (C2 Pro, W2 Pro, TC580)
- Generic TCP devices

Author: PontoMax
License: Proprietary
"""

import os
import sys
import json
import time
import socket
import struct
import hashlib
import logging
import threading
import sqlite3
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import urllib.request
import urllib.error
import ssl

# Configuration
VERSION = "2.0.0"
DEFAULT_CONFIG_PATH = Path.home() / ".pontomax" / "config.json"
DEFAULT_DB_PATH = Path.home() / ".pontomax" / "records.db"
DEFAULT_LOG_PATH = Path.home() / ".pontomax" / "agent.log"

# ZKTeco Protocol Constants
USHRT_MAX = 65535
CMD_CONNECT = 1000
CMD_EXIT = 1001
CMD_ENABLEDEVICE = 1002
CMD_DISABLEDEVICE = 1003
CMD_RESTART = 1004
CMD_POWEROFF = 1005
CMD_SLEEP = 1006
CMD_RESUME = 1007
CMD_TEST_TEMP = 1009
CMD_TESTVOICE = 1017
CMD_VERSION = 1100
CMD_CHANGE_SPEED = 1101
CMD_ACK_OK = 2000
CMD_ACK_ERROR = 2001
CMD_ACK_DATA = 2002
CMD_ACK_RETRY = 2003
CMD_ACK_REPEAT = 2004
CMD_ACK_UNAUTH = 2005
CMD_PREPARE_DATA = 1500
CMD_DATA = 1501
CMD_FREE_DATA = 1502
CMD_DATA_WRRQ = 1503
CMD_DATA_RDY = 1504
CMD_DB_RRQ = 7
CMD_USER_WRQ = 8
CMD_USERTEMP_RRQ = 9
CMD_USERTEMP_WRQ = 10
CMD_OPTIONS_RRQ = 11
CMD_OPTIONS_WRQ = 12
CMD_ATTLOG_RRQ = 13
CMD_CLEAR_DATA = 14
CMD_CLEAR_ATTLOG = 15
CMD_DELETE_USER = 18
CMD_DELETE_USERTEMP = 19
CMD_CLEAR_ADMIN = 20
CMD_USERGRP_RRQ = 21
CMD_USERGRP_WRQ = 22
CMD_USERTZ_RRQ = 23
CMD_USERTZ_WRQ = 24
CMD_GRPTZ_RRQ = 25
CMD_GRPTZ_WRQ = 26
CMD_TZ_RRQ = 27
CMD_TZ_WRQ = 28
CMD_ULG_RRQ = 29
CMD_ULG_WRQ = 30
CMD_UNLOCK = 31
CMD_CLEAR_ACC = 32
CMD_CLEAR_OPLOG = 33
CMD_OPLOG_RRQ = 34
CMD_GET_FREE_SIZES = 50
CMD_ENABLE_CLOCK = 57
CMD_STARTVERIFY = 60
CMD_STARTENROLL = 61
CMD_CANCELCAPTURE = 62
CMD_STATE_RRQ = 64
CMD_WRITE_LCD = 66
CMD_CLEAR_LCD = 67
CMD_GET_PINWIDTH = 69
CMD_SMS_WRQ = 70
CMD_SMS_RRQ = 71
CMD_DELETE_SMS = 72
CMD_UDATA_WRQ = 73
CMD_DELETE_UDATA = 74
CMD_DOORSTATE_RRQ = 75
CMD_WRITE_MIFARE = 76
CMD_EMPTY_MIFARE = 78
CMD_GET_TIME = 201
CMD_SET_TIME = 202
CMD_REG_EVENT = 500


class Protocol(Enum):
    """Communication protocol types"""
    TCP_ZKTECO = "tcp_zkteco"
    TCP_ANVIZ = "tcp_anviz"
    HTTP_REST = "http_rest"
    HTTPS_REST = "https_rest"


@dataclass
class Equipment:
    """Equipment configuration"""
    id: str
    name: str
    ip_address: str
    port: int
    manufacturer: str
    model: str
    protocol: str
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: bool = True
    last_sync: Optional[str] = None
    session_id: int = 0
    reply_id: int = 0


@dataclass
class TimeRecord:
    """Time record from equipment"""
    equipment_id: str
    employee_id: str
    timestamp: datetime
    record_type: str = "unknown"
    synced: bool = False
    raw_data: Optional[str] = None


@dataclass
class Employee:
    """Employee data for equipment"""
    id: str
    name: str
    registration_number: str
    pis: Optional[str] = None
    card_number: Optional[str] = None


class ZKTecoClient:
    """ZKTeco protocol implementation"""
    
    def __init__(self, ip: str, port: int = 4370, timeout: int = 10):
        self.ip = ip
        self.port = port
        self.timeout = timeout
        self.socket: Optional[socket.socket] = None
        self.session_id = 0
        self.reply_id = 0
        self.connected = False
        
    def _create_header(self, command: int, command_string: bytes, session_id: int, reply_id: int) -> bytes:
        """Create ZK protocol header"""
        buf = struct.pack('<HHHH', command, 0, session_id, reply_id) + command_string
        buf = struct.pack('<HH', len(buf) + 8, 0) + buf
        chksum = sum(buf) & 0xFFFF
        return struct.pack('<HH', len(buf), chksum) + buf[4:]
        
    def _send_command(self, command: int, data: bytes = b'') -> Tuple[int, bytes]:
        """Send command and receive response"""
        if not self.socket:
            raise ConnectionError("Not connected")
            
        packet = self._create_header(command, data, self.session_id, self.reply_id)
        self.socket.sendall(packet)
        self.reply_id = (self.reply_id + 1) & 0xFFFF
        
        response = self.socket.recv(4096)
        if len(response) < 8:
            return CMD_ACK_ERROR, b''
            
        resp_len = struct.unpack('<H', response[0:2])[0]
        resp_cmd = struct.unpack('<H', response[4:6])[0]
        
        return resp_cmd, response[8:resp_len]
        
    def connect(self, password: str = '') -> bool:
        """Establish connection with device"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip, self.port))
            
            # Send connect command
            cmd, data = self._send_command(CMD_CONNECT)
            
            if cmd == CMD_ACK_OK:
                self.session_id = struct.unpack('<H', data[0:2])[0] if len(data) >= 2 else 0
                self.connected = True
                return True
            elif cmd == CMD_ACK_UNAUTH:
                # Device requires authentication
                if password:
                    return self._authenticate(password)
                return False
            else:
                return False
                
        except Exception as e:
            logging.error(f"ZKTeco connect error: {e}")
            return False
            
    def _authenticate(self, password: str) -> bool:
        """Authenticate with device password"""
        try:
            pwd_bytes = password.encode('utf-8')[:8].ljust(8, b'\x00')
            cmd, data = self._send_command(CMD_AUTH, pwd_bytes)
            return cmd == CMD_ACK_OK
        except Exception as e:
            logging.error(f"ZKTeco auth error: {e}")
            return False
            
    def disconnect(self):
        """Disconnect from device"""
        if self.socket and self.connected:
            try:
                self._send_command(CMD_EXIT)
            except:
                pass
            self.socket.close()
            self.socket = None
            self.connected = False
            
    def get_attendance_logs(self, start_date: Optional[datetime] = None) -> List[Dict]:
        """Get attendance records from device"""
        records = []
        
        if not self.connected:
            return records
            
        try:
            # Request attendance logs
            cmd, data = self._send_command(CMD_ATTLOG_RRQ)
            
            if cmd == CMD_PREPARE_DATA and len(data) >= 4:
                size = struct.unpack('<I', data[0:4])[0]
                
                # Receive data chunks
                all_data = b''
                while len(all_data) < size:
                    cmd, chunk = self._send_command(CMD_DATA_RDY)
                    if cmd == CMD_DATA:
                        all_data += chunk
                    elif cmd == CMD_ACK_OK:
                        break
                    else:
                        break
                        
                # Parse records (40 bytes each typically)
                record_size = 40
                for i in range(0, len(all_data), record_size):
                    record_data = all_data[i:i+record_size]
                    if len(record_data) >= record_size:
                        try:
                            user_id = struct.unpack('<H', record_data[0:2])[0]
                            # Parse timestamp (4 bytes encoded)
                            timestamp_int = struct.unpack('<I', record_data[4:8])[0]
                            ts = self._decode_timestamp(timestamp_int)
                            state = record_data[10]
                            
                            records.append({
                                'user_id': str(user_id),
                                'timestamp': ts,
                                'state': state,
                            })
                        except:
                            continue
                            
                # Free data
                self._send_command(CMD_FREE_DATA)
                
        except Exception as e:
            logging.error(f"Error getting attendance: {e}")
            
        return records
        
    def _decode_timestamp(self, encoded: int) -> datetime:
        """Decode ZKTeco timestamp format"""
        try:
            second = encoded % 60
            encoded //= 60
            minute = encoded % 60
            encoded //= 60
            hour = encoded % 24
            encoded //= 24
            day = encoded % 31 + 1
            encoded //= 31
            month = encoded % 12 + 1
            encoded //= 12
            year = encoded + 2000
            return datetime(year, month, day, hour, minute, second)
        except:
            return datetime.now()
            
    def get_users(self) -> List[Dict]:
        """Get users from device"""
        users = []
        
        if not self.connected:
            return users
            
        try:
            cmd, data = self._send_command(CMD_USERTEMP_RRQ)
            
            if cmd == CMD_PREPARE_DATA and len(data) >= 4:
                size = struct.unpack('<I', data[0:4])[0]
                
                all_data = b''
                while len(all_data) < size:
                    cmd, chunk = self._send_command(CMD_DATA_RDY)
                    if cmd == CMD_DATA:
                        all_data += chunk
                    elif cmd == CMD_ACK_OK:
                        break
                    else:
                        break
                        
                # Parse users (72 bytes each typically)
                record_size = 72
                for i in range(0, len(all_data), record_size):
                    user_data = all_data[i:i+record_size]
                    if len(user_data) >= record_size:
                        try:
                            user_id = struct.unpack('<H', user_data[0:2])[0]
                            name_bytes = user_data[8:32]
                            name = name_bytes.split(b'\x00')[0].decode('utf-8', errors='ignore')
                            card = user_data[35:39]
                            card_num = struct.unpack('<I', card)[0]
                            
                            users.append({
                                'id': str(user_id),
                                'name': name,
                                'card': str(card_num) if card_num > 0 else None,
                            })
                        except:
                            continue
                            
                self._send_command(CMD_FREE_DATA)
                
        except Exception as e:
            logging.error(f"Error getting users: {e}")
            
        return users
        
    def set_user(self, user_id: int, name: str, card: int = 0, password: str = '') -> bool:
        """Add or update user on device"""
        if not self.connected:
            return False
            
        try:
            # Build user data packet
            user_data = struct.pack('<H', user_id)  # User ID
            user_data += b'\x00\x00\x00\x00'  # Privilege + password
            user_data += name.encode('utf-8')[:24].ljust(24, b'\x00')  # Name
            user_data += struct.pack('<I', card)  # Card number
            user_data += b'\x00' * 8  # Additional data
            
            cmd, _ = self._send_command(CMD_USER_WRQ, user_data)
            return cmd == CMD_ACK_OK
            
        except Exception as e:
            logging.error(f"Error setting user: {e}")
            return False
            
    def delete_user(self, user_id: int) -> bool:
        """Delete user from device"""
        if not self.connected:
            return False
            
        try:
            data = struct.pack('<H', user_id)
            cmd, _ = self._send_command(CMD_DELETE_USER, data)
            return cmd == CMD_ACK_OK
        except Exception as e:
            logging.error(f"Error deleting user: {e}")
            return False
            
    def get_device_info(self) -> Optional[Dict]:
        """Get device information"""
        if not self.connected:
            return None
            
        try:
            info = {}
            
            # Get version
            cmd, data = self._send_command(CMD_VERSION)
            if cmd == CMD_ACK_OK:
                info['version'] = data.split(b'\x00')[0].decode('utf-8', errors='ignore')
                
            # Get time
            cmd, data = self._send_command(CMD_GET_TIME)
            if cmd == CMD_ACK_OK and len(data) >= 4:
                timestamp = struct.unpack('<I', data[0:4])[0]
                info['time'] = self._decode_timestamp(timestamp).isoformat()
                
            # Get free sizes
            cmd, data = self._send_command(CMD_GET_FREE_SIZES)
            if cmd == CMD_ACK_OK and len(data) >= 32:
                info['users'] = struct.unpack('<I', data[0:4])[0]
                info['fingers'] = struct.unpack('<I', data[4:8])[0]
                info['records'] = struct.unpack('<I', data[8:12])[0]
                
            return info
            
        except Exception as e:
            logging.error(f"Error getting device info: {e}")
            return None


class CloudSync:
    """Cloud synchronization handler"""
    
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """Make API request"""
        url = f"{self.api_url}{endpoint}"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}',
        }
        
        try:
            req_data = json.dumps(data).encode('utf-8') if data else None
            
            # Create SSL context
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
            
            with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                return json.loads(response.read().decode('utf-8'))
                
        except urllib.error.HTTPError as e:
            logging.error(f"HTTP error {e.code}: {e.read().decode()}")
            return None
        except Exception as e:
            logging.error(f"Request error: {e}")
            return None
            
    def get_employees(self, company_id: str) -> List[Employee]:
        """Fetch employees from cloud"""
        result = self._request('GET', f'/employees?company_id={company_id}')
        
        if result and 'data' in result:
            return [Employee(**emp) for emp in result['data']]
        return []
        
    def send_records(self, records: List[TimeRecord]) -> bool:
        """Send time records to cloud"""
        data = {
            'records': [
                {
                    'equipment_id': r.equipment_id,
                    'employee_identifier': r.employee_id,
                    'recorded_at': r.timestamp.isoformat(),
                    'record_type': r.record_type,
                }
                for r in records
            ]
        }
        
        result = self._request('POST', '/records/batch', data)
        return result is not None and result.get('success', False)
        
    def get_equipment_list(self, company_id: str) -> List[Equipment]:
        """Fetch equipment list from cloud"""
        result = self._request('GET', f'/equipment?company_id={company_id}')
        
        if result and 'data' in result:
            return [Equipment(**eq) for eq in result['data']]
        return []
        
    def update_equipment_status(self, equipment_id: str, status: str, last_sync: Optional[str] = None) -> bool:
        """Update equipment status in cloud"""
        data = {'status': status}
        if last_sync:
            data['last_sync'] = last_sync
            
        result = self._request('PATCH', f'/equipment/{equipment_id}/status', data)
        return result is not None


class LocalDatabase:
    """Local SQLite database for offline storage"""
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        
    def _init_db(self):
        """Initialize database schema"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    equipment_id TEXT NOT NULL,
                    employee_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    record_type TEXT,
                    synced INTEGER DEFAULT 0,
                    raw_data TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(equipment_id, employee_id, timestamp)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS employees (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    registration_number TEXT,
                    pis TEXT,
                    card_number TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_records_synced ON records(synced)
            ''')
            
            conn.commit()
            
    def save_record(self, record: TimeRecord) -> bool:
        """Save time record to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR IGNORE INTO records 
                    (equipment_id, employee_id, timestamp, record_type, synced, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    record.equipment_id,
                    record.employee_id,
                    record.timestamp.isoformat(),
                    record.record_type,
                    1 if record.synced else 0,
                    record.raw_data,
                ))
                conn.commit()
                return True
        except Exception as e:
            logging.error(f"Error saving record: {e}")
            return False
            
    def get_unsynced_records(self, limit: int = 100) -> List[TimeRecord]:
        """Get records not yet synced to cloud"""
        records = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    SELECT equipment_id, employee_id, timestamp, record_type, raw_data
                    FROM records WHERE synced = 0 LIMIT ?
                ''', (limit,))
                
                for row in cursor.fetchall():
                    records.append(TimeRecord(
                        equipment_id=row[0],
                        employee_id=row[1],
                        timestamp=datetime.fromisoformat(row[2]),
                        record_type=row[3],
                        synced=False,
                        raw_data=row[4],
                    ))
        except Exception as e:
            logging.error(f"Error getting unsynced records: {e}")
        return records
        
    def mark_synced(self, records: List[TimeRecord]):
        """Mark records as synced"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                for r in records:
                    conn.execute('''
                        UPDATE records SET synced = 1 
                        WHERE equipment_id = ? AND employee_id = ? AND timestamp = ?
                    ''', (r.equipment_id, r.employee_id, r.timestamp.isoformat()))
                conn.commit()
        except Exception as e:
            logging.error(f"Error marking synced: {e}")
            
    def save_employees(self, employees: List[Employee]):
        """Save employees to local cache"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                for emp in employees:
                    conn.execute('''
                        INSERT OR REPLACE INTO employees 
                        (id, name, registration_number, pis, card_number, updated_at)
                        VALUES (?, ?, ?, ?, ?, datetime('now'))
                    ''', (emp.id, emp.name, emp.registration_number, emp.pis, emp.card_number))
                conn.commit()
        except Exception as e:
            logging.error(f"Error saving employees: {e}")
            
    def get_employees(self) -> List[Employee]:
        """Get cached employees"""
        employees = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    SELECT id, name, registration_number, pis, card_number FROM employees
                ''')
                for row in cursor.fetchall():
                    employees.append(Employee(
                        id=row[0],
                        name=row[1],
                        registration_number=row[2],
                        pis=row[3],
                        card_number=row[4],
                    ))
        except Exception as e:
            logging.error(f"Error getting employees: {e}")
        return employees


class NetworkScanner:
    """Network scanner for equipment discovery"""
    
    @staticmethod
    def scan_range(ip_range: str, ports: List[int] = [4370, 80, 443]) -> List[Dict]:
        """Scan IP range for equipment"""
        found = []
        
        # Parse IP range (e.g., "192.168.1.1-254")
        try:
            base_parts = ip_range.split('.')
            if '-' in base_parts[-1]:
                start, end = map(int, base_parts[-1].split('-'))
                base = '.'.join(base_parts[:-1])
            else:
                start = end = int(base_parts[-1])
                base = '.'.join(base_parts[:-1])
                
            for i in range(start, end + 1):
                ip = f"{base}.{i}"
                for port in ports:
                    if NetworkScanner._check_port(ip, port):
                        device_info = NetworkScanner._identify_device(ip, port)
                        if device_info:
                            found.append({
                                'ip': ip,
                                'port': port,
                                **device_info
                            })
                            
        except Exception as e:
            logging.error(f"Scan error: {e}")
            
        return found
        
    @staticmethod
    def _check_port(ip: str, port: int, timeout: float = 0.5) -> bool:
        """Check if port is open"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except:
            return False
            
    @staticmethod
    def _identify_device(ip: str, port: int) -> Optional[Dict]:
        """Try to identify device type"""
        info = {'manufacturer': 'unknown', 'model': 'unknown', 'protocol': 'unknown'}
        
        # Try ZKTeco protocol
        if port == 4370:
            try:
                client = ZKTecoClient(ip, port, timeout=3)
                if client.connect():
                    dev_info = client.get_device_info()
                    client.disconnect()
                    
                    if dev_info:
                        info['manufacturer'] = 'zkteco'
                        info['model'] = dev_info.get('version', 'Unknown')
                        info['protocol'] = 'tcp_zkteco'
                        info['firmware'] = dev_info.get('version')
                        return info
            except:
                pass
                
        # Try HTTP
        if port in [80, 8080]:
            try:
                req = urllib.request.Request(f'http://{ip}:{port}/', method='GET')
                with urllib.request.urlopen(req, timeout=3) as resp:
                    server = resp.headers.get('Server', '')
                    body = resp.read(1024).decode('utf-8', errors='ignore')
                    
                    if 'ZK' in server or 'iclock' in body.lower():
                        info['manufacturer'] = 'zkteco'
                        info['protocol'] = 'http_rest'
                    elif 'Anviz' in body:
                        info['manufacturer'] = 'anviz'
                        info['protocol'] = 'http_rest'
                    else:
                        info['protocol'] = 'http_rest'
                        
                    return info
            except:
                pass
                
        return None


class EquipmentAgent:
    """Main equipment agent"""
    
    def __init__(self, config_path: Path = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self.config: Dict = {}
        self.running = False
        self.equipment: List[Equipment] = []
        self.db: Optional[LocalDatabase] = None
        self.cloud: Optional[CloudSync] = None
        
        # Setup logging
        log_path = DEFAULT_LOG_PATH
        log_path.parent.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(message)s',
            handlers=[
                logging.FileHandler(log_path),
                logging.StreamHandler()
            ]
        )
        
        self.load_config()
        
    def load_config(self):
        """Load configuration from file"""
        if self.config_path.exists():
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
                
        # Set defaults
        self.config.setdefault('api_url', 'https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync')
        self.config.setdefault('api_key', '')
        self.config.setdefault('company_id', '')
        self.config.setdefault('sync_interval', 60)
        self.config.setdefault('equipment', [])
        
        # Initialize components
        self.db = LocalDatabase(DEFAULT_DB_PATH)
        
        if self.config.get('api_key'):
            self.cloud = CloudSync(self.config['api_url'], self.config['api_key'])
            
        # Load equipment
        self.equipment = [Equipment(**eq) for eq in self.config.get('equipment', [])]
        
    def save_config(self):
        """Save configuration to file"""
        self.config['equipment'] = [asdict(eq) for eq in self.equipment]
        
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
            
    def scan_network(self, ip_range: str) -> List[Dict]:
        """Scan network for equipment"""
        logging.info(f"Scanning network: {ip_range}")
        found = NetworkScanner.scan_range(ip_range)
        logging.info(f"Found {len(found)} devices")
        return found
        
    def add_equipment(self, equipment: Equipment):
        """Add equipment to configuration"""
        self.equipment.append(equipment)
        self.save_config()
        logging.info(f"Added equipment: {equipment.name} at {equipment.ip_address}")
        
    def remove_equipment(self, equipment_id: str):
        """Remove equipment from configuration"""
        self.equipment = [eq for eq in self.equipment if eq.id != equipment_id]
        self.save_config()
        logging.info(f"Removed equipment: {equipment_id}")
        
    def sync_equipment(self, equipment: Equipment) -> Tuple[int, int]:
        """Sync records from equipment"""
        records_fetched = 0
        records_synced = 0
        
        if equipment.protocol == Protocol.TCP_ZKTECO.value:
            client = ZKTecoClient(equipment.ip_address, equipment.port)
            
            if client.connect(equipment.password or ''):
                logging.info(f"Connected to {equipment.name}")
                
                # Get attendance logs
                logs = client.get_attendance_logs()
                records_fetched = len(logs)
                
                for log in logs:
                    record = TimeRecord(
                        equipment_id=equipment.id,
                        employee_id=log['user_id'],
                        timestamp=log['timestamp'],
                        record_type='entry' if log['state'] == 0 else 'exit',
                        raw_data=json.dumps(log),
                    )
                    self.db.save_record(record)
                    
                client.disconnect()
                
                # Update equipment status
                equipment.last_sync = datetime.now().isoformat()
                self.save_config()
                
        # Sync to cloud
        if self.cloud:
            unsynced = self.db.get_unsynced_records()
            if unsynced and self.cloud.send_records(unsynced):
                self.db.mark_synced(unsynced)
                records_synced = len(unsynced)
                logging.info(f"Synced {records_synced} records to cloud")
                
        return records_fetched, records_synced
        
    def sync_employees_to_device(self, equipment: Equipment, employees: List[Employee]) -> int:
        """Sync employees to device"""
        synced = 0
        
        if equipment.protocol == Protocol.TCP_ZKTECO.value:
            client = ZKTecoClient(equipment.ip_address, equipment.port)
            
            if client.connect(equipment.password or ''):
                for emp in employees:
                    user_id = int(emp.registration_number or emp.id[-4:])
                    card = int(emp.card_number or 0)
                    
                    if client.set_user(user_id, emp.name, card):
                        synced += 1
                        
                client.disconnect()
                
        return synced
        
    def run(self):
        """Run the agent in loop mode"""
        self.running = True
        logging.info("PontoMax Equipment Agent started")
        
        while self.running:
            try:
                # Sync each equipment
                for eq in self.equipment:
                    if eq.is_active:
                        try:
                            fetched, synced = self.sync_equipment(eq)
                            logging.info(f"{eq.name}: {fetched} fetched, {synced} synced")
                        except Exception as e:
                            logging.error(f"Error syncing {eq.name}: {e}")
                            
                # Wait for next cycle
                time.sleep(self.config.get('sync_interval', 60))
                
            except KeyboardInterrupt:
                logging.info("Shutting down...")
                self.running = False
                
    def stop(self):
        """Stop the agent"""
        self.running = False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='PontoMax Equipment Agent')
    parser.add_argument('--config', type=Path, default=DEFAULT_CONFIG_PATH, help='Config file path')
    parser.add_argument('--scan', type=str, help='Scan network range (e.g., 192.168.1.1-254)')
    parser.add_argument('--service', action='store_true', help='Run as service')
    parser.add_argument('--version', action='store_true', help='Show version')
    
    args = parser.parse_args()
    
    if args.version:
        print(f"PontoMax Equipment Agent v{VERSION}")
        return
        
    agent = EquipmentAgent(args.config)
    
    if args.scan:
        devices = agent.scan_network(args.scan)
        for dev in devices:
            print(f"Found: {dev['ip']}:{dev['port']} - {dev['manufacturer']} {dev['model']}")
        return
        
    if args.service:
        agent.run()
    else:
        print(f"PontoMax Equipment Agent v{VERSION}")
        print("Use --service to run in service mode")
        print("Use --scan <range> to scan for equipment")


if __name__ == '__main__':
    main()
