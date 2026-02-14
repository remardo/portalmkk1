import { useOutletContext } from "react-router-dom";
import type { LayoutOutletContext } from "../components/layout/AppLayout";

export function useLayoutContext() {
  return useOutletContext<LayoutOutletContext>();
}