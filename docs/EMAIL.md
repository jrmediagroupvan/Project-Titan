# Email Configuration

Each user may connect a private mailbox. Users cannot access another user's private email.

Supported approaches:

- Gmail OAuth
- Google Workspace OAuth
- IMAP and SMTP
- Shared team mailboxes with explicit permissions

## Common Settings

| Provider | SMTP | Port | IMAP | Port |
|---|---|---:|---|---:|
| Gmail | smtp.gmail.com | 465 or 587 | imap.gmail.com | 993 |
| Microsoft 365 | smtp.office365.com | 587 | outlook.office365.com | 993 |
| Yahoo | smtp.mail.yahoo.com | 465 | imap.mail.yahoo.com | 993 |
| iCloud | smtp.mail.me.com | 587 | imap.mail.me.com | 993 |
| Zoho | smtp.zoho.com | 465 | imap.zoho.com | 993 |

Use app passwords when required.

## Email-to-Quote

TITAN can create review drafts from customer messages. It should flag missing material, weight, or time instead of inventing values. Customer emails are not sent automatically without approval.
