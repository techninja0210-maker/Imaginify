import Header from "@/components/shared/Header";

const PrivacyPage = () => {
  return (
    <>
      <Header title="Privacy Policy" />
      <section className="mt-10 space-y-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <p className="text-sm text-gray-500 mb-6">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="p-16-regular text-gray-700">
                ShoppableVideos.com ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              <p className="p-16-regular text-gray-700 mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4">
                <li>Account information (name, email, username)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Content you upload and process through the Service</li>
                <li>Usage data and preferences</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="p-16-regular text-gray-700 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process transactions and manage your account</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze usage patterns</li>
                <li>Detect, prevent, and address technical issues</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Information Sharing and Disclosure</h2>
              <p className="p-16-regular text-gray-700">
                We do not sell your personal information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4 mt-4">
                <li>With service providers who assist us in operating our Service (e.g., Stripe for payments, Clerk for authentication)</li>
                <li>When required by law or to protect our rights</li>
                <li>In connection with a business transfer or merger</li>
                <li>With your consent</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
              <p className="p-16-regular text-gray-700">
                We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
              <p className="p-16-regular text-gray-700">
                We retain your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this Privacy Policy. We may retain certain information for longer periods as required by law or for legitimate business purposes.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="p-16-regular text-gray-700 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 p-16-regular text-gray-700 ml-4">
                <li>Access and update your account information</li>
                <li>Delete your account and associated data</li>
                <li>Opt-out of certain communications</li>
                <li>Request a copy of your personal data</li>
                <li>Object to certain processing activities</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Third-Party Services</h2>
              <p className="p-16-regular text-gray-700">
                Our Service integrates with third-party services (Stripe, Clerk, etc.). These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of third-party services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cookies and Tracking Technologies</h2>
              <p className="p-16-regular text-gray-700">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Children's Privacy</h2>
              <p className="p-16-regular text-gray-700">
                Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. International Data Transfers</h2>
              <p className="p-16-regular text-gray-700">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our Service, you consent to the transfer of your information to these countries.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to This Privacy Policy</h2>
              <p className="p-16-regular text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="p-16-regular text-gray-700">
                If you have any questions about this Privacy Policy, please contact us through the support channels provided in the Service.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PrivacyPage;
