import { useEffect } from 'react'

export function PrivacyPolicy() {
  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0)
    // Update document title
    document.title = 'Privacy Policy - Pegasus by NeuraTech'
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground mt-2">
                Effective Date: January 27, 2026
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              ← Back to App
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-invert max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Introduction</h2>
            <p className="text-foreground/90 leading-relaxed">
              Pegasus by NeuraTech ("we", "our", "the Service") operates as a SaaS platform designed to help users manage and consolidate KPI data from multiple sources. This service integrates with multiple data sources including Meta Ads, Google Analytics 4 (GA4), and Shopify, consolidating metrics into Google Sheets.
            </p>
            <p className="text-foreground/90 leading-relaxed">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please discontinue use of our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Personal Information</h3>
            <p className="text-foreground/90 mb-3">When you register for an account with our Service, we may collect personal identification information including:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li>Email address</li>
              <li>Name</li>
              <li>Account preferences and settings</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Business Data</h3>
            <p className="text-foreground/90 mb-3">Our Service processes business-related data that you provide through:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li>Google Sheets data you connect to our Service</li>
              <li>KPI metrics from integrated platforms (Meta Ads, Google Analytics 4, Shopify)</li>
              <li>Custom reports and dashboards you create within our Service</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Credentials and Authentication Data</h3>
            <p className="text-foreground/90 mb-3">To facilitate data integration, we collect and securely store:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li>Google Sheets service account credentials</li>
              <li>Meta Ads API credentials</li>
              <li>Google Analytics 4 credentials</li>
              <li>Shopify API credentials</li>
              <li>Any other third-party service credentials you provide for integration</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Technical Information</h3>
            <p className="text-foreground/90 mb-3">We may collect technical information about your device and usage patterns:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Page views and navigation patterns</li>
              <li>Time and date of visits</li>
              <li>Referring website</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">How We Use Your Information</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Primary Uses</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Service Provision:</strong> To operate and maintain our Service</li>
              <li><strong>Data Integration:</strong> To connect with your Google Sheets and other data sources</li>
              <li><strong>Analytics:</strong> To provide KPI tracking and reporting functionality</li>
              <li><strong>Account Management:</strong> To manage your user account and preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Security and Compliance</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Authentication:</strong> To verify your identity and authorize access</li>
              <li><strong>Data Encryption:</strong> To encrypt your credentials and sensitive data</li>
              <li><strong>Audit Logging:</strong> To maintain security logs for compliance and troubleshooting</li>
              <li><strong>Incident Response:</strong> To detect and respond to security incidents</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Service Improvement</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Performance Analysis:</strong> To improve Service performance and user experience</li>
              <li><strong>Feature Development:</strong> To develop new features based on usage patterns</li>
              <li><strong>Bug Detection:</strong> To identify and fix technical issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Data Security and Encryption</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Credential Protection</h3>
            <p className="text-foreground/90 mb-3">We implement robust security measures to protect your credentials:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Encryption at Rest:</strong> All credentials are encrypted using AES-256-GCM encryption</li>
              <li><strong>User-Specific Keys:</strong> Each user's credentials are encrypted with user-specific keys derived from their user ID</li>
              <li><strong>Secure Storage:</strong> Credentials are stored in encrypted form in our PostgreSQL database</li>
              <li><strong>No Plaintext Storage:</strong> We never store credentials in plaintext format</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Data Isolation</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Row-Level Security (RLS):</strong> Database-level security ensures complete isolation between users</li>
              <li><strong>User Context:</strong> All database queries are automatically filtered by user ID</li>
              <li><strong>Access Control:</strong> Users can only access their own data, enforced at both application and database levels</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Authentication</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Clerk Integration:</strong> We use Clerk for secure JWT-based authentication</li>
              <li><strong>Token Validation:</strong> All API requests require valid JWT tokens</li>
              <li><strong>Session Management:</strong> Secure session handling with proper token expiration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Data Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Third-Party Services</h3>
            <p className="text-foreground/90 mb-3">We share your data with third parties only as necessary for Service functionality:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Google APIs:</strong> To access your Google Sheets and related services</li>
              <li><strong>Meta APIs:</strong> To retrieve your advertising metrics</li>
              <li><strong>Google Analytics APIs:</strong> To access your analytics data</li>
              <li><strong>Shopify APIs:</strong> To retrieve your e-commerce metrics</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Service Providers</h3>
            <p className="text-foreground/90 mb-3">We may share limited information with trusted service providers who assist us in:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Cloud Infrastructure:</strong> Hosting and database services</li>
              <li><strong>Payment Processing:</strong> Payment transaction processing</li>
              <li><strong>Customer Support:</strong> Customer service and support</li>
              <li><strong>Analytics:</strong> Usage analytics and performance monitoring</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Legal Requirements</h3>
            <p className="text-foreground/90">We may disclose your information if required to do so by law or in response to valid requests by public authorities, including to meet national security or law enforcement requirements.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Data Retention and Deletion</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Retention Periods</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Account Data:</strong> Retained as long as your account remains active</li>
              <li><strong>Credentials:</strong> Retained as long as you maintain the integration</li>
              <li><strong>Activity Logs:</strong> Retained for 1 year for security and compliance purposes</li>
              <li><strong>Backup Data:</strong> May be retained for up to 30 days in accordance with backup policies</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Account Deletion</h3>
            <p className="text-foreground/90 mb-3">When you delete your account:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li>Your personal information is removed from our active systems</li>
              <li>Your credentials are securely deleted from our database</li>
              <li>Your data integrations are disconnected</li>
              <li>Some information may be retained for legal compliance requirements</li>
              <li>Audit logs may be retained for security and compliance purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Your Rights and Choices</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Data Access Rights</h3>
            <p className="text-foreground/90 mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Access:</strong> Request copies of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Restriction:</strong> Restrict processing of your personal data</li>
              <li><strong>Portability:</strong> Receive your personal data in a structured format</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">Opt-Out Options</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Account Deletion:</strong> You may delete your account at any time</li>
              <li><strong>Integration Removal:</strong> You may remove any data integrations at any time</li>
              <li><strong>Communication Preferences:</strong> You may update your communication preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">How to Exercise Your Rights</h3>
            <p className="text-foreground/90">To exercise any of these rights, please contact us at [contact email]. We will respond to your request within 30 days.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Children's Privacy</h2>
            <p className="text-foreground/90">Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children without verification of parental consent, we will take steps to remove that information from our servers.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">International Data Transfers</h2>
            <p className="text-foreground/90">Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those of your jurisdiction. We take appropriate safeguards to ensure that your personal data receives the same level of protection regardless of where it is processed.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Security Measures</h2>
            <p className="text-foreground/90 mb-3">We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These measures include:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Encryption:</strong> Industry-standard encryption for data at rest and in transit</li>
              <li><strong>Access Controls:</strong> Role-based access controls and authentication</li>
              <li><strong>Monitoring:</strong> Continuous monitoring for security threats</li>
              <li><strong>Regular Audits:</strong> Periodic security assessments and audits</li>
              <li><strong>Employee Training:</strong> Regular security awareness training for staff</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Changes to This Privacy Policy</h2>
            <p className="text-foreground/90">We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">Contact Us</h2>
            <p className="text-foreground/90 mb-3">If you have any questions about this Privacy Policy, please contact us:</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
              <li><strong>Email:</strong> [contact email]</li>
              <li><strong>Address:</strong> [company address]</li>
              <li><strong>Website:</strong> [website URL]</li>
            </ul>
            <p className="text-foreground/90 mt-4">For security-related concerns, please contact our Data Protection Officer directly at [security contact email].</p>
          </section>

          <div className="border-t border-border pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              <strong>Last Updated:</strong> January 27, 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
