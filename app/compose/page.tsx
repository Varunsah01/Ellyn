import { DraftEditor } from "@/components/DraftEditor";

export default function ComposePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compose Email</h1>
        <p className="text-muted-foreground">
          Create personalized outreach emails using templates
        </p>
      </div>
      <DraftEditor />
    </div>
  );
}
