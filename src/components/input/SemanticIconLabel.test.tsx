import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttributeIconLabel, RoleIconLabel } from "./SemanticIconLabel";

describe("SemanticIconLabel", () => {
  it("属性を文字なしのアクセシブルなアイコンで表示する", () => {
    render(<AttributeIconLabel attribute="火" />);

    expect(screen.getByRole("img", { name: "火" })).toHaveAttribute("title", "火");
    expect(screen.queryByText("火")).not.toBeInTheDocument();
  });

  it("ロールを文字なしのアクセシブルなアイコンで表示する", () => {
    render(<RoleIconLabel role="ヒーラー" />);

    expect(screen.getByRole("img", { name: "ヒーラー" })).toHaveAttribute("title", "ヒーラー");
    expect(screen.queryByText("ヒーラー")).not.toBeInTheDocument();
  });
});
