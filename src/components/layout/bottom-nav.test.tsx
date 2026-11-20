import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BottomNav } from "@/components/layout/bottom-nav";

describe("BottomNav", () => {
  it("renders five mobile destinations with a prominent add action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Add expense" })).toHaveAttribute("href", "/add");
    expect(within(nav).getByText("Home")).toBeInTheDocument();
    expect(within(nav).getByText("Expenses")).toBeInTheDocument();
    expect(within(nav).getByText("Reports")).toBeInTheDocument();
    expect(within(nav).getByText("More")).toBeInTheDocument();
    expect(within(nav).getByText("Add")).toBeInTheDocument();
  });

  it("marks the current destination for assistive technology", () => {
    render(
      <MemoryRouter initialEntries={["/expenses"]}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Expenses/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
