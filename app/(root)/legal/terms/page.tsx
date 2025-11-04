import Header from "@/components/shared/Header";

const TermsPage = () => {
  return (
    <>
      <Header title="Terms of Service" />
      <section className="mt-10 space-y-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <p className="text-sm text-gray-500 mb-6">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="p-16-regular text-gray-700">
                By accessing and using ShoppableVideos.com (&quot;Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="p-16-regular text-gray-700">
                ShoppableVideos.com provides AI-powered video processing and transformation services. The Service allows users to create, process, and transform videos using various workflows and AI technologies. Credits are required to use the Service, which can be purchased through subscription plans or one-time top-ups.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
              <p className="p-16-regular text-gray-700">
                You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must provide accurate, current, and complete information during registration.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Credits and Billing</h2>
              <p className="p-16-regular text-gray-700 mb-4">
                Credits are required to use our Service. Credits can be obtained through:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4">
                <li>Monthly subscription plans</li>
                <li>One-time credit purchases</li>
                <li>Auto top-up features (when enabled)</li>
              </ul>
              <p className="p-16-regular text-gray-700 mt-4">
                All payments are processed through Stripe. Subscription fees are billed in advance on a monthly basis. Unused credits do not roll over to the next billing cycle unless otherwise specified. Refunds are subject to our refund policy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Subscription Plans</h2>
              <p className="p-16-regular text-gray-700">
                You may upgrade, downgrade, or cancel your subscription at any time. Changes to your subscription will be prorated and applied to your next billing cycle. Cancellation of your subscription will take effect at the end of your current billing period.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. User Content</h2>
              <p className="p-16-regular text-gray-700">
                You retain all ownership rights to content you upload and process through the Service. By using the Service, you grant us a limited license to use, process, and store your content solely for the purpose of providing the Service to you.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Prohibited Uses</h2>
              <p className="p-16-regular text-gray-700 mb-4">
                You may not use the Service:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4">
                <li>For any illegal purpose or in violation of any laws</li>
                <li>To transmit harmful, offensive, or inappropriate content</li>
                <li>To attempt to gain unauthorized access to the Service</li>
                <li>To interfere with or disrupt the Service</li>
                <li>To reverse engineer or attempt to extract the source code</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Service Availability</h2>
              <p className="p-16-regular text-gray-700">
                We strive to provide reliable service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or unforeseen circumstances. We are not liable for any loss or damage resulting from Service unavailability.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Refund Policy</h2>
              <p className="p-16-regular text-gray-700">
                We offer a 14-day money-back guarantee for new subscriptions. Refund requests must be submitted within 14 days of purchase. Refunds for one-time credit purchases are considered on a case-by-case basis. Processed jobs are non-refundable.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Limitation of Liability</h2>
              <p className="p-16-regular text-gray-700">
                To the maximum extent permitted by law, ShoppableVideos.com shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Termination</h2>
              <p className="p-16-regular text-gray-700">
                We reserve the right to terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
              <p className="p-16-regular text-gray-700">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the new Terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Information</h2>
              <p className="p-16-regular text-gray-700">
                If you have any questions about these Terms, please contact us through the support channels provided in the Service.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default TermsPage;
