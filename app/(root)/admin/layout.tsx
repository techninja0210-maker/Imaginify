import AdminNavbar from '@/components/admin/AdminNavbar';
import { Toaster } from '@/components/ui/toaster';

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-screen bg-gray-50">
      <AdminNavbar />
      
      <div className="min-h-[calc(100vh-4rem)]">
        {children}
      </div>
      
      <Toaster />
    </main>
  );
};

export default AdminLayout;

