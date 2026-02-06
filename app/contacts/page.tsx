import { ContactTable } from "@/components/contact-table";

export default function ContactsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your discovered contacts
        </p>
      </div>

      <ContactTable />
    </div>
  );
}
