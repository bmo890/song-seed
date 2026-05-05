import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_WORKSPACE_COLOR,
  getWorkspaceTheme,
  WORKSPACE_THEME_MAP,
  type WorkspaceTheme,
} from "../workspaceTheme";

const WorkspaceThemeContext = createContext<WorkspaceTheme>(
  WORKSPACE_THEME_MAP[DEFAULT_WORKSPACE_COLOR]
);

export function WorkspaceThemeProvider({
  color,
  children,
}: {
  color?: string;
  children: ReactNode;
}) {
  const theme = useMemo(() => getWorkspaceTheme(color), [color]);
  return (
    <WorkspaceThemeContext.Provider value={theme}>
      {children}
    </WorkspaceThemeContext.Provider>
  );
}

export function useWorkspaceTheme(): WorkspaceTheme {
  return useContext(WorkspaceThemeContext);
}
