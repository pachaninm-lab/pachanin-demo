export function LiveResourceTable({
  rows,
  title = 'Live resources'
}: {
  rows: Array<Record<string, string | number | null | undefined>>;
  title?: string;
}) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="overflow-x-auto" style={{ marginTop: 12 }}>
        <table className="data-table">
          <thead>
            <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => <td key={col}>{String(row[col] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
