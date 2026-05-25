import { uploadFile } from "../api";
import { usePlanContext } from "../PlanContext";

function ImportBlock({ title, path }: { title: string; path: string }) {
  return (
    <div className="form-row">
      <strong>{title}</strong>
      <input
        type="file"
        accept=".csv"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = await uploadFile(path, f);
          alert(`OK: ${JSON.stringify(r)}`);
        }}
      />
    </div>
  );
}

export default function Imports() {
  const { planId } = usePlanContext();
  const reseed = async () => {
    await fetch("/api/v1/admin/reseed", { method: "POST", headers: { "X-User-Id": "admin" } });
    alert("Демо-данные пересозданы. Обновите страницу (F5).");
  };

  return (
    <div>
      <h2>Импорт справочников</h2>
      <div className="card">
        <ImportBlock title="Оргструктура" path="/api/v1/import/org-units" />
        <ImportBlock title="Позиции" path="/api/v1/import/positions" />
        {planId && (
          <ImportBlock title="Сотрудники + декабрь" path={`/api/v1/plans/${planId}/import/employees`} />
        )}
        <ImportBlock
          title="Грейд-сетка"
          path="/api/v1/salary-ranges/import?plan_year=2026&version_label=csv"
        />
        {planId && (
          <ImportBlock title="Факт (месяц 1)" path={`/api/v1/plans/${planId}/fact/2026/1/import`} />
        )}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Демо с нуля</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          Если страницы пустые — пересоздайте демо-БД (2 сотрудника на P-100, грейд-сетка, план, факт янв).
        </p>
        <button type="button" className="secondary" onClick={reseed}>
          Пересоздать демо-данные
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        Шаблоны: docs/templates/*.csv
      </p>
    </div>
  );
}
