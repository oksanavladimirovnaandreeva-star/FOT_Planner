import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

type User = {
  username: string;
  display_name: string;
  role: string;
  scope_org_codes: string[];
};

const AuthContext = createContext<{
  user: User | null;
  setUserId: (id: string) => void;
  reload: () => void;
}>({ user: null, setUserId: () => {}, reload: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const reload = () => {
    api<User>("/api/v1/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  };

  const setUserId = (id: string) => {
    localStorage.setItem("fot_user", id);
    reload();
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUserId, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
