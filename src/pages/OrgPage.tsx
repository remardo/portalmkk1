import { ChevronDown, Star } from "lucide-react";
import { useState } from "react";
import { Card } from "../components/ui/Card";
import { RoleLabels } from "../domain/models";
import { usePortalData } from "../hooks/usePortalData";

export function OrgPage() {
  const { data } = usePortalData();
  const [selectedOffice, setSelectedOffice] = useState<number | null>(null);

  if (!data) {
    return null;
  }

  const director = data.users.find((item) => item.role === "director");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Оргструктура и контакты</h1>

      {director ? (
        <Card className="border-l-4 border-teal-500 p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{director.avatar}</span>
            <div>
              <p className="font-bold text-gray-900">{director.name}</p>
              <p className="text-sm text-teal-600">{director.position}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{director.email}</span>
                <span>{director.phone}</span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.offices.map((office) => {
          const staff = data.users.filter(
            (user) => user.officeId === office.id && user.role !== "director" && user.role !== "admin",
          );
          const isOpen = selectedOffice === office.id;

          return (
            <Card key={office.id} className="overflow-hidden">
              <button
                className="w-full p-4 text-left"
                onClick={() => setSelectedOffice(isOpen ? null : office.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{office.name}</h3>
                    <p className="text-sm text-gray-500">{office.city}, {office.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-semibold">{office.rating}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="space-y-2 border-t bg-gray-50 px-4 py-3">
                  {staff.map((user) => (
                    <div key={user.id} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{user.avatar}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="text-xs text-gray-400">{RoleLabels[user.role]}</p>
                      </div>
                      <p className="text-xs text-gray-400">{user.phone}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

