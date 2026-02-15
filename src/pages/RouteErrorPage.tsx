import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Произошла ошибка";
  let details = "Попробуйте обновить страницу или вернуться на главную.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    details = typeof error.data === "string" ? error.data : details;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-900">{title}</h1>
        <p className="mt-2 text-sm text-red-800">{details}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            На главную
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    </div>
  );
}

