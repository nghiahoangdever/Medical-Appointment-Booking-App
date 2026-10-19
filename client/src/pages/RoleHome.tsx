import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';

interface RoleHomeProps {
  title: string;
  /** Use cases this area will offer, shown until they're implemented. */
  upcoming: string[];
}

/** Placeholder dashboard for each role until its phase is built. */
export function RoleHome({ title, upcoming }: RoleHomeProps) {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={title} subtitle={`Xin chào, ${user?.fullName}`} />
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Sắp ra mắt
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
