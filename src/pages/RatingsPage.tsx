import { Award, Star } from "lucide-react";
import { Card } from "../components/ui/Card";
import { RoleLabels } from "../domain/models";
import { usePortalData } from "../hooks/usePortalData";

export function RatingsPage() {
  const { data } = usePortalData();
  if (!data) {
    return null;
  }

  const sortedOffices = [...data.offices].sort((a, b) => b.rating - a.rating);
  const sortedUsers = [...data.users].filter((item) => item.role !== "admin").sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Рейтинги</h1>

      <div className="space-y-2">
        {sortedOffices.map((office, index) => (
          <Card key={office.id} className="p-4">
            <div className="flex items-center gap-3">
              <span className="w-7 text-center text-sm font-semibold">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{office.name}</p>
                <p className="text-sm text-gray-500">{office.city}</p>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-bold">{office.rating}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {sortedUsers.map((user, index) => {
          const office = data.offices.find((item) => item.id === user.officeId);
          return (
            <Card key={user.id} className="p-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{index + 1}</span>
                <span className="text-2xl">{user.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="truncate text-xs text-gray-400">
                    {RoleLabels[user.role]} • {office?.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold">{user.points}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
