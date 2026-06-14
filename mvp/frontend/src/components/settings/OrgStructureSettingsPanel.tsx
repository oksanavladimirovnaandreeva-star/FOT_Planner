import { useMemo, useRef, useState } from "react";
import { useMvpApp } from "../../context/MvpAppContext";
import { countOrgNodes, importOrgTree, listOrgHistory, parseOrgCsv, readOrgTree, resetOrgTreeToSeed } from "../../data/orgStructureStore";
import { formatIsoDateTime } from "../../data/formatDisplay";

export function OrgStructureSettingsPanel() {
  const { refreshAppConfig, appConfigRevision } = useMvpApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [pendingFile, setPendingFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseOrgCsv> | null>(null);

  const tree = useMemo(() => readOrgTree(), [appConfigRevision, pendingFile, message]);
  const counts = useMemo(() => countOrgNodes(tree), [tree]);
  const history = useMemo(() => listOrgHistory(), [message]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = parseOrgCsv(text);
    setPendingFile({ name: file.name, text });
    setPreview(parsed);
    setMessage(null);
  };

  const applyImport = () => {
    if (!preview || preview.rowCount === 0) {
      setMessage("Нет строк для импорта.");
      return;
    }
    const { entry } = importOrgTree(preview.tree, importMode, pendingFile?.name);
    setPendingFile(null);
    setPreview(null);
    setMessage(`${entry.summary}. Обновите страницу планирования при необходимости.`);
    refreshAppConfig();
  };

  const handleReset = () => {
    const entry = resetOrgTreeToSeed();
    setMessage(entry.summary);
    refreshAppConfig();
  };

  return (
    <div className="org-settings">
      <p className="muted-line">
        Дерево dept → unit → team хранится в браузере. CSV: колонки <code>department</code>, <code>unit</code>,{" "}
        <code>team</code> (разделитель <code>;</code> или <code>,</code>).
      </p>
      <p className="settings-scope">
        Сейчас: {counts.departmentCount} деп. · {counts.unitCount} юнитов · {counts.teamCount} команд
      </p>

      <div className="app-data-panel__actions">
        <button type="button" className="app-btn app-btn--primary" onClick={() => fileRef.current?.click()}>
          Загрузить CSV
        </button>
        <button type="button" className="app-btn app-btn--ghost" onClick={handleReset}>
          Сбросить к демо
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
      </div>

      <div className="app-data-panel__mode">
        <label>
          <input
            type="radio"
            name="org-import-mode"
            checked={importMode === "replace"}
            onChange={() => setImportMode("replace")}
          />{" "}
          Заменить дерево
        </label>
        <label>
          <input
            type="radio"
            name="org-import-mode"
            checked={importMode === "merge"}
            onChange={() => setImportMode("merge")}
          />{" "}
          Дополнить (merge)
        </label>
      </div>

      {preview ? (
        <div className="app-data-panel__preview">
          <p>
            Файл: <strong>{pendingFile?.name}</strong> · строк: {preview.rowCount}
            {preview.errors.length > 0 ? ` · предупреждений: ${preview.errors.length}` : ""}
          </p>
          {preview.errors.length > 0 ? (
            <ul className="app-data-panel__warnings">
              {preview.errors.slice(0, 5).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <div className="app-data-panel__actions">
            <button type="button" className="app-btn app-btn--primary" onClick={applyImport}>
              Подтвердить импорт
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={() => { setPreview(null); setPendingFile(null); }}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="settings-scope">{message}</p> : null}

      <details className="settings-help">
        <summary>Журнал изменений оргструктуры</summary>
        {history.length === 0 ? (
          <p className="muted-line">Импортов пока не было — используется демо-дерево.</p>
        ) : (
          <ul className="org-settings__history">
            {history.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <strong>{formatIsoDateTime(entry.at)}</strong> — {entry.summary}
                {entry.fileName ? ` · ${entry.fileName}` : ""}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
