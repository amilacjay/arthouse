import { AppShell } from "@/components/app-shell";
import { EditorProvider } from "@/lib/store";

export default function Home() {
  return (
    <EditorProvider>
      <AppShell />
    </EditorProvider>
  );
}
