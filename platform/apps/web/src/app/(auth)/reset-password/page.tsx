import { Suspense } from 'react';
import { ResetForm } from './reset-form';

export const metadata = { title: 'Nova senha' };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
