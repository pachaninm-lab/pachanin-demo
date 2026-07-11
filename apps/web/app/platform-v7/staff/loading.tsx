export default function StaffLoading() {
  return (
    <section className='pc-staff-state' aria-live='polite' aria-busy='true'>
      <span aria-hidden='true'>◆</span>
      <h1>Staff Access Control Plane</h1>
      <p>Проверяем серверную сессию, MFA и действующие полномочия.</p>
    </section>
  );
}
