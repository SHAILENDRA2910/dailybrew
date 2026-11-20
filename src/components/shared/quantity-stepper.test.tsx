import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuantityStepper } from "@/components/shared/quantity-stepper";

describe("QuantityStepper", () => {
  it("exposes large, labelled controls and disables decrease at the minimum", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} onChange={onChange} itemName="Tea Medium" />);

    expect(screen.getByRole("button", { name: /Decrease Tea Medium/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Increase Tea Medium/i })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /Tea Medium quantity/i })).toHaveValue("1");
  });

  it("increments and accepts direct numeric entry", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <QuantityStepper value={2} onChange={onChange} itemName="Biscuit" />,
    );

    await user.click(screen.getByRole("button", { name: /Increase Biscuit/i }));
    expect(onChange).toHaveBeenCalledWith(3);

    rerender(<QuantityStepper value={3} onChange={onChange} itemName="Biscuit" />);
    fireEvent.change(screen.getByRole("textbox", { name: /Biscuit quantity/i }), {
      target: { value: "12" },
    });
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("clamps direct entry at the configured maximum", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper value={5} max={99} onChange={onChange} itemName="Toast" />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Toast quantity/i }), {
      target: { value: "999" },
    });
    expect(onChange).toHaveBeenLastCalledWith(99);
  });
});
