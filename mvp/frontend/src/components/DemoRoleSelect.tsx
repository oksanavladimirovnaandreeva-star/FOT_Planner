import { useNavigate } from "react-router-dom";
import { USER_ROLE_LABELS, useMvpApp } from "../context/MvpAppContext";
import type { UserRole } from "../data/userAccess";
import { landingRouteForRole } from "../data/roleLanding";

type Props = {
  compact?: boolean;
};

export function DemoRoleSelect({ compact = false }: Props) {
  const navigate = useNavigate();
  const { userRole, setUserRole } = useMvpApp();

  const handleChange = (role: UserRole) => {
    setUserRole(role);
    navigate(landingRouteForRole(role));
  };

  return (
    <label className={`app-field${compact ? " app-field--demo-role" : ""}`}>
      <span>{compact ? "Роль (демо)" : "Текущая роль"}</span>
      <select value={userRole} onChange={(event) => handleChange(event.target.value as UserRole)}>
        {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((role) => (
          <option key={role} value={role}>
            {USER_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </label>
  );
}
