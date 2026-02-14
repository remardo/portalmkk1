import { describe, expect, it } from "vitest";
import { mapProfileToUser } from "../services/authStorage";

describe("mapProfileToUser", () => {
  it("maps backend profile to frontend user", () => {
    const user = mapProfileToUser({
      id: "4f8cf652-1dc5-4e02-a8c4-0d2fcf12ba10",
      full_name: "Иван Иванов",
      role: "operator",
      office_id: 7,
      email: "ivan@example.com",
      phone: "+7-900-000-00-00",
      points: 10,
      position: "Операционист",
      avatar: null,
    });

    expect(user.id).toBe("4f8cf652-1dc5-4e02-a8c4-0d2fcf12ba10");
    expect(user.name).toBe("Иван Иванов");
    expect(user.officeId).toBe(7);
    expect(user.avatar).toBe("👤");
  });
});