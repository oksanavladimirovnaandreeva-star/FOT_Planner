import { useEffect, useState } from "react";
import { api } from "../api";

type Log = {
  username: string;
  action: string;
  entity_type: string;
  created_at: string;
  details: Record<string, unknown>;
};

export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    api<Log[]>("/api/v1/audit").then(setLogs);
  }, []);

  return (
    <div>
      <h2>Журнал изменений</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Пользователь</th>
              <th>Действие</th>
              <th>Сущность</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td>{l.created_at}</td>
                <td>{l.username}</td>
                <td>{l.action}</td>
                <td>{l.entity_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
