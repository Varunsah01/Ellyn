import { Navigation } from "@/components/landing/Navigation";
import { Footer } from "@/components/landing/Footer";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <h1 className="font-fraunces text-4xl md:text-5xl font-bold text-foreground mb-8">
          Privacy Policy
        </h1>
        <div className="prose prose-slate max-w-none font-dm-sans text-muted-foreground space-y-6">
          <p className="text-lg">Last Updated: February 11, 2026</p>
          
          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">1. Introduction</h2>
            <p>
              At Ellyn ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and browser extension.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">2. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create an account or sign up for our services.</li>
              <li>Use our browser extension to find professional contact information.</li>
              <li>Communicate with us via email or support channels.</li>
            </ul>
            <p>
              This may include your name, email address, and professional information related to your job search.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our services.</li>
              <li>Personalize your experience and optimize your job search outreach.</li>
              <li>Analyze usage patterns to improve user interface and functionality.</li>
              <li>Send technical notices, updates, and support messages.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information from unauthorized access, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">5. Data Sharing</h2>
            <p>
              We do not sell your personal information to third parties. We may share information with service providers who assist us in operating our business, provided they agree to keep this information confidential.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal information. You can manage your account settings within the Ellyn dashboard or contact us for assistance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-fraunces text-2xl font-semibold text-foreground">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@useellyn.com.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
