import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../app/ProtectedRoute";
import { AuthContext, type AuthContextValue } from "../contexts/auth-context";

function renderWithAuth(path: string, auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<div>Dashboard Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const baseAuth: Omit<AuthContextValue, "isAuthenticated" | "isLoading"> = {
  user: null,
  login: async () => undefined,
  logout: () => undefined,
};

describe("ProtectedRoute smoke", () => {
  it("redirects anonymous user to login", async () => {
    renderWithAuth("/", {
      ...baseAuth,
      isAuthenticated: false,
      isLoading: false,
    });

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("renders child route for authenticated user", async () => {
    renderWithAuth("/", {
      ...baseAuth,
      user: {
        id: "user-1",
        name: "Smoke User",
        role: "operator",
        officeId: 1,
        avatar: "",
        email: "smoke@example.com",
        phone: "",
        points: 0,
        position: "",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
  });
});
