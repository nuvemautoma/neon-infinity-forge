import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageClonerEditor } from "@/components/PageCloner/Editor";

export const Route = createFileRoute("/cloner/$id")({
  component: ClonerEditorPage,
  head: () => ({ meta: [{ title: "Editor — Clonador" }] }),
});

function ClonerEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/acess" }); return; }
      const { data: page, error } = await supabase
        .from("cloned_pages")
        .select("id,name,editor_data")
        .eq("id", id)
        .single();
      if (error || !page) { navigate({ to: "/cloner" }); return; }
      setData(page);
    })();
  }, [id, navigate]);

  if (!data) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const ed = data.editor_data || {};
  const html = typeof ed.__html === "string" ? ed.__html : "";
  const editorData = ed.__html ? null : ed;

  return (
    <PageClonerEditor
      pageId={data.id}
      initialName={data.name}
      initialHtml={html}
      initialEditorData={editorData}
    />
  );
}
