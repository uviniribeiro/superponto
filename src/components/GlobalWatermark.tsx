import superpontoLogo from '@/assets/superponto-logo-modern.png';

export function GlobalWatermark() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <img 
        src={superpontoLogo} 
        alt="" 
        className="w-[40vw] max-w-[500px] min-w-[200px] opacity-[0.03] select-none"
        style={{
          filter: 'grayscale(100%)',
        }}
      />
    </div>
  );
}
