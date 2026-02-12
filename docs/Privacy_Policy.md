# Privacy Policy for Pegasus by NeuraTech

**Effective Date:** January 30, 2026

## Introduction

Pegasus by NeuraTech ("we", "our", "the Service") operates as a SaaS platform designed to help users manage and consolidate KPI data from multiple sources. This service integrates with multiple data sources including Meta Ads, Google Analytics 4 (GA4), and Shopify, consolidating metrics into Google Sheets.

This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please discontinue use of our Service.

## Information We Collect

### Personal Information
When you register for an account with our Service, we may collect personal identification information including:
- Email address
- Name
- Account preferences and settings

### Business Data
Our Service processes business-related data that you provide through:
- Google Sheets data you connect to our Service
- KPI metrics from integrated platforms (Meta Ads, Google Analytics 4, Shopify)
- Custom reports and dashboards you create within our Service

### Credentials and Authentication Data
To facilitate data integration, we collect and securely store:
- Google Sheets service account credentials
- Meta Ads API credentials
- Google Analytics 4 credentials
- Shopify API credentials
- Any other third-party service credentials you provide for integration

### Technical Information
We may collect technical information about your device and usage patterns:
- IP address
- Browser type and version
- Operating system
- Page views and navigation patterns
- Time and date of visits
- Referring website

## How We Use Your Information

### Primary Uses
- **Service Provision**: To operate and maintain our Service
- **Data Integration**: To connect with your Google Sheets and other data sources
- **Analytics**: To provide KPI tracking and reporting functionality
- **Account Management**: To manage your user account and preferences

### Security and Compliance
- **Authentication**: To verify your identity and authorize access
- **Data Encryption**: To encrypt your credentials and sensitive data
- **Audit Logging**: To maintain security logs for compliance and troubleshooting
- **Incident Response**: To detect and respond to security incidents

### Service Improvement
- **Performance Analysis**: To improve Service performance and user experience
- **Feature Development**: To develop new features based on usage patterns
- **Bug Detection**: To identify and fix technical issues

## Data Security and Encryption

### Credential Protection
We implement robust security measures to protect your credentials:
- **Encryption at Rest**: All credentials are encrypted using AES-256-GCM encryption
- **User-Specific Keys**: Each user's credentials are encrypted with user-specific keys derived from their user ID
- **Secure Storage**: Credentials are stored in encrypted form in our PostgreSQL database
- **No Plaintext Storage**: We never store credentials in plaintext format

### Data Isolation
- **Row-Level Security (RLS)**: Database-level security ensures complete isolation between users
- **User Context**: All database queries are automatically filtered by user ID
- **Access Control**: Users can only access their own data, enforced at both application and database levels

### Authentication
- **Clerk Integration**: We use Clerk for secure JWT-based authentication
- **Token Validation**: All API requests require valid JWT tokens
- **Session Management**: Secure session handling with proper token expiration

## Data Sharing and Disclosure

### Third-Party Services
We share your data with third parties only as necessary for Service functionality:
- **Google APIs**: To access your Google Sheets and related services
- **Meta APIs**: To retrieve your advertising metrics
- **Google Analytics APIs**: To access your analytics data
- **Shopify APIs**: To retrieve your e-commerce metrics

### Service Providers
We may share limited information with trusted service providers who assist us in:
- **Cloud Infrastructure**: Hosting and database services
- **Payment Processing**: Payment transaction processing
- **Customer Support**: Customer service and support
- **Analytics**: Usage analytics and performance monitoring

### Legal Requirements
We may disclose your information if required to do so by law or in response to valid requests by public authorities, including to meet national security or law enforcement requirements.

## Data Retention and Deletion

### Retention Periods
- **Account Data**: Retained as long as your account remains active
- **Credentials**: Retained as long as you maintain the integration
- **Activity Logs**: Retained for 1 year for security and compliance purposes
- **Backup Data**: May be retained for up to 30 days in accordance with backup policies

### Account Deletion
When you delete your account:
- Your personal information is removed from our active systems
- Your credentials are securely deleted from our database
- Your data integrations are disconnected
- Some information may be retained for legal compliance requirements
- Audit logs may be retained for security and compliance purposes

## Your Rights and Choices

### Data Access Rights
You have the right to:
- **Access**: Request copies of your personal data
- **Rectification**: Correct inaccurate personal data
- **Erasure**: Request deletion of your personal data
- **Restriction**: Restrict processing of your personal data
- **Portability**: Receive your personal data in a structured format

### Opt-Out Options
- **Account Deletion**: You may delete your account at any time
- **Integration Removal**: You may remove any data integrations at any time
- **Communication Preferences**: You may update your communication preferences

### How to Exercise Your Rights
To exercise any of these rights, please contact us at [contact email]. We will respond to your request within 30 days.

## Children's Privacy

Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children without verification of parental consent, we will take steps to remove that information from our servers.

## International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those of your jurisdiction. We take appropriate safeguards to ensure that your personal data receives the same level of protection regardless of where it is processed.

## Security Measures

We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These measures include:
- **Encryption**: Industry-standard encryption for data at rest and in transit
- **Access Controls**: Role-based access controls and authentication
- **Monitoring**: Continuous monitoring for security threats
- **Regular Audits**: Periodic security assessments and audits
- **Employee Training**: Regular security awareness training for staff

## Changes to This Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.

## Contact Us

If you have any questions about this Privacy Policy, please contact us:

- **Email**: [contact email]
- **Address**: [company address]
- **Website**: [website URL]

For security-related concerns, please contact our Data Protection Officer directly at [security contact email].

---

**Last Updated**: January 30, 2026