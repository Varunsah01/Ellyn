import { Navigation } from "@/components/landing/navigation";
import { Footer } from "@/components/landing/footer";

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <h1 className="font-fraunces text-4xl md:text-5xl font-bold text-foreground mb-8">
          Terms of Service
        </h1>
        <div className="prose prose-slate max-w-none font-dm-sans text-muted-foreground space-y-6">
          <p className="text-lg">Last Updated: February 11, 2026</p>
          
          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Ellyn ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Ellyn provides tools for job seekers to find professional contact information and manage their outreach efforts. We reserve the right to modify or discontinue the Service at any time without notice.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">3. User Responsibilities</h2>
            <p>
              You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintaining the confidentiality of your account information.</li>
              <li>Ensuring that your use of the Service complies with all applicable laws and regulations.</li>
              <li>The content of any communications sent using our platform.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">4. Prohibited Conduct</h2>
            <p>
              You agree not to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service.</li>
              <li>Reverse engineer or attempt to extract the source code of our software.</li>
              <li>Use automated systems (bots, scrapers, etc.) to access the Service in an unauthorized manner.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">5. Intellectual Property</h2>
            <p>
              All content and software provided through the Service are the property of Ellyn or its licensors and are protected by copyright, trademark, and other laws.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">6. Limitation of Liability</h2>
            <p>
              Ellyn shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">7. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users or the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">8. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Eigenspace Technologies PVT.Ltd. is registered.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">9. Contact Information</h2>
            <p>
              Questions about the Terms of Service should be sent to us at support@useellyn.com.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
