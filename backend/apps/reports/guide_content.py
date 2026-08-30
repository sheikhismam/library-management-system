"""Admin guide content in English and Bengali.

Single source of truth for the in-page Admin Guide (served as JSON to the
frontend) and for the downloadable English/Bengali guide PDFs.
"""

GUIDE_SECTIONS = {
    "en": [
        {
            "key": "introduction",
            "title": "1. Introduction",
            "paragraphs": [
                "The Library Management System (LMS) is a web application that lets you manage books, members, circulation, fines, reservations, reports, and audit logs from a single admin portal.",
                "This guide explains every module step by step. You can read it on screen (switch between English and Bengali with the language button in the top bar) or download it as a PDF from the Admin Guide page.",
            ],
        },
        {
            "key": "dashboard",
            "title": "2. Dashboard",
            "paragraphs": [
                "After logging in you land on the Analytics Dashboard. It shows summary cards for total books, copies, active loans, overdue loans, members, authors, publishers, genres, and fines collected or pending.",
                "Below the cards you will find a 12-month borrowing trend chart, the genre distribution, a list of the most-borrowed books, and a recent activity feed.",
                "The dashboard is read-only. Use the menu to open the other modules.",
            ],
        },
        {
            "key": "managingBooks",
            "title": "3. Managing Books",
            "paragraphs": [
                "Open the Books page from the menu. Use the search box and the available/unavailable filters to find books quickly.",
                "Click \"Create Book\" to add a new book. Title and ISBN are required. Choose or type an author, a publisher, and a genre; the sub-genre is optional and is filtered by the selected genre. You can upload a cover image or paste an image URL.",
                "Click a book title to open its details page, where you can see copies, shelf location, reviews, and the QR code. Use the Edit button to change details; books can also be deleted from the list.",
            ],
        },
        {
            "key": "managingMembers",
            "title": "4. Managing Members",
            "paragraphs": [
                "Open the Members page from the menu. Search members by name, email, or member code.",
                "Click \"Create Member\" to register a new member. First name, last name, and email are required. Set the membership status and expiry date, and upload a profile photo if you like.",
                "Open a member to see their active loans, unpaid fines, borrowing history, and QR code. Members can be suspended or activated from the list, and profiles can be edited or deleted.",
            ],
        },
        {
            "key": "circulation",
            "title": "5. Circulation",
            "paragraphs": [
                "Circulation covers issuing, renewing, and returning books.",
                "To issue a book, select a member and a book (or scan their QR codes with the Scan QR button), choose the loan duration in days, add optional notes, and press \"Issue Book\".",
                "Active and overdue loans are shown in tables. Overdue loans show the overdue days and assessed fine. A loan can be renewed (unless it is overdue or already renewed the maximum number of times) and returned; returning an overdue book automatically assesses a fine.",
            ],
        },
        {
            "key": "fines",
            "title": "6. Fines",
            "paragraphs": [
                "The Fines page lists every fine with its member, book, due date, amount, and status.",
                "Filter by status or search by member, book, or reason.",
                "A pending fine can be marked as paid or waived. Confirm the action in the dialog that opens; the change is immediately written to the audit log.",
            ],
        },
        {
            "key": "reservations",
            "title": "7. Reservations",
            "paragraphs": [
                "Reservations let members request a book that is currently on loan or not yet available.",
                "Use \"New Reservation\" and search for the book and the member. Each reservation has a priority; higher-priority reservations are served first.",
                "When a copy becomes available, open the reservation and press Fulfill to issue the book (this creates a 14-day loan) or Cancel to remove the request.",
            ],
        },
        {
            "key": "reports",
            "title": "8. Reports",
            "paragraphs": [
                "The Reports page lets you download three PDF reports.",
                "The Inventory Report lists every book with ISBN, authors, genres, copies, shelf location, and status. The Overdue Loans Report lists all currently overdue borrowings with fines. The Member History Report bundles a single member's borrowing history, unpaid fines, reservations, and approved reviews.",
                "Every report is generated from the current database state at download time, and the PDF header shows the exact date and time of generation using Bangladesh local time (Asia/Dhaka). Reports are authenticated — never share report URLs.",
            ],
        },
        {
            "key": "auditLogs",
            "title": "9. Audit Logs",
            "paragraphs": [
                "The Audit Logs page records every important action in the system: creations, updates, deletions, circulation events, and fine payments.",
                "Filter by action, search across action, entity, and details, and open a row to see the full raw details of the event.",
                "Audit logs are read-only. They help you trace who did what and when.",
            ],
        },
        {
            "key": "theme",
            "title": "10. Light/Dark mode",
            "paragraphs": [
                "Use the sun/moon button in the top bar of the header to switch between light and dark mode.",
                "Your preference is saved in the browser and applied on every page the next time you visit.",
            ],
        },
        {
            "key": "language",
            "title": "11. English/Bengali language switching",
            "paragraphs": [
                "Use the language button in the top bar of the header to switch the entire interface between English and Bengali.",
                "The choice is saved in the browser and remembered on your next visit. Your preference only translates the interface; book titles, member names, and other saved data stay unchanged.",
            ],
        },
        {
            "key": "logout",
            "title": "12. Logout",
            "paragraphs": [
                "Click \"Logout\" in the top bar of the header and confirm the dialog to end your session safely.",
                "You will be returned to the login page. Sessions are never ended by simply closing the browser tab, so always log out on shared computers.",
            ],
        },
    ],
    "bn": [
        {
            "key": "introduction",
            "title": "১. ভূমিকা",
            "paragraphs": [
                "লাইব্রেরি ম্যানেজমেন্ট সিস্টেম (LMS) একটি ওয়েব অ্যাপ্লিকেশন যা দিয়ে আপনি একটি একক অ্যাডমিন পোর্টাল থেকে বই, সদস্য, সার্কুলেশন, জরিমানা, রিজার্ভেশন, রিপোর্ট এবং অডিট লগ পরিচালনা করতে পারবেন।",
                "এই গাইডটি প্রতিটি মডিউল ধাপে ধাপে ব্যাখ্যা করে। আপনি এটি স্ক্রিনে পড়তে পারেন (শীর্ষ বারের ভাষা বাটন দিয়ে ইংরেজি ও বাংলার মধ্যে পরিবর্তন করুন) বা অ্যাডমিন গাইড পৃষ্ঠা থেকে PDF হিসেবে ডাউনলোড করতে পারেন।",
            ],
        },
        {
            "key": "dashboard",
            "title": "২. ড্যাশবোর্ড",
            "paragraphs": [
                "লগইনের পর আপনি অ্যানালিটিক্স ড্যাশবোর্ডে পৌঁছান। এখানে মোট বই, কপি, সক্রিয় ঋণ, অতিদেরি ঋণ, সদস্য, লেখক, প্রকাশক, ধারা এবং আদায়কৃত বা বকেয়া জরিমানার সংক্ষিপ্ত কার্ড রয়েছে।",
                "কার্ডগুলোর নিচে ১২ মাসের ঋণগ্রহণের প্রবণতা চার্ট, ধারা অনুযায়ী বণ্টন, সবচেয়ে বেশি ধার নেওয়া বইয়ের তালিকা এবং সাম্প্রতিক কার্যক্রমের ফিড দেখতে পাবেন।",
                "ড্যাশবোর্ডটি শুধু পড়ার জন্য। অন্যান্য মডিউল খুলতে মেনু ব্যবহার করুন।",
            ],
        },
        {
            "key": "managingBooks",
            "title": "৩. বই ব্যবস্থাপনা",
            "paragraphs": [
                "মেনু থেকে বই পৃষ্ঠাটি খুলুন। দ্রুত বই খুঁজতে সার্চ বক্স এবং উপলব্ধ/অনুপলব্ধ ফিল্টার ব্যবহার করুন।",
                "নতুন বই যোগ করতে \"বই তৈরি করুন\" চাপুন। শিরোনাম ও আইএসবিএন আবশ্যক। লেখক, প্রকাশক ও ধারা নির্বাচন করুন বা লিখুন; উপ-ধারা ঐচ্ছিক এবং নির্বাচিত ধারা অনুযায়ী ফিল্টার হয়। প্রচ্ছদ ছবি আপলোড বা ছবির URL পেস্ট করতে পারেন।",
                "বইয়ের শিরোনামে ক্লিক করে বিবরণ পৃষ্ঠা খুলুন, যেখানে কপি, তাকের অবস্থান, রিভিউ এবং কিউআর কোড দেখতে পাবেন। বিবরণ পরিবর্তন করতে সম্পাদনা বাটন ব্যবহার করুন; তালিকা থেকে বই মুছতেও পারেন।",
            ],
        },
        {
            "key": "managingMembers",
            "title": "৪. সদস্য ব্যবস্থাপনা",
            "paragraphs": [
                "মেনু থেকে সদস্য পৃষ্ঠাটি খুলুন। নাম, ইমেইল বা সদস্য কোড দিয়ে সদস্য খুঁজুন।",
                "নতুন সদস্য নিবন্ধন করতে \"সদস্য তৈরি করুন\" চাপুন। প্রথম নাম, শেষ নাম ও ইমেইল আবশ্যক। সদস্যপদ স্থিতি ও মেয়াদোত্তীর্ণের তারিখ নির্ধারণ করুন এবং চাইলে প্রোফাইল ছবি আপলোড করুন।",
                "সদস্য খুললে তার সক্রিয় ঋণ, অপরিশোধিত জরিমানা, ঋণের ইতিহাস এবং কিউআর কোড দেখতে পাবেন। তালিকা থেকে সদস্যকে স্থগিত বা সক্রিয় করা যায়, এবং প্রোফাইল সম্পাদনা বা মুছেও যায়।",
            ],
        },
        {
            "key": "circulation",
            "title": "৫. সার্কুলেশন",
            "paragraphs": [
                "সার্কুলেশন মডিউলে বই ইস্যু, নবায়ন ও ফেরতের কাজ হয়।",
                "বই ইস্যু করতে একজন সদস্য ও একটি বই নির্বাচন করুন (বা কিউআর স্ক্যান বাটন দিয়ে তাদের কিউআর কোড স্ক্যান করুন), দিনে ঋণের সময়কাল বেছে নিন, ঐচ্ছিক নোট যোগ করুন এবং \"বই ইস্যু করুন\" চাপুন।",
                "সক্রিয় ও অতিদেরি ঋণ টেবিলে দেখানো হয়। অতিদেরি ঋণে অতিদেরি দিন ও ধার্য জরিমানা দেখা যায়। একটি ঋণ নবায়ন করা যায় (যদি অতিদেরি না হয়ে থাকে বা সর্বোচ্চ নবায়ন সীমায় না পৌঁছায়) এবং ফেরত নেওয়া যায়; অতিদেরি বই ফেরত দিলে স্বয়ংক্রিয়ভাবে জরিমানা ধার্য হয়।",
            ],
        },
        {
            "key": "fines",
            "title": "৬. জরিমানা",
            "paragraphs": [
                "জরিমানা পৃষ্ঠায় সদস্য, বই, ফেরতের তারিখ, পরিমাণ ও অবস্থাসহ প্রতিটি জরিমানা তালিকাভুক্ত থাকে।",
                "অবস্থা দিয়ে ফিল্টার করুন বা সদস্য, বই, কারণ দিয়ে খুঁজুন।",
                "বকেয়া জরিমানা পরিশোধিত বা মওকুফ হিসেবে চিহ্নিত করা যায়। খোলা ডায়ালগে কাজটি নিশ্চিত করুন; পরিবর্তন সাথে সাথে অডিট লগে লেখা হয়।",
            ],
        },
        {
            "key": "reservations",
            "title": "৭. রিজার্ভেশন",
            "paragraphs": [
                "রিজার্ভেশন দিয়ে সদস্যরা বর্তমানে ঋণে থাকা বা এখনো উপলব্ধ নয় এমন বইয়ের অনুরোধ করতে পারেন।",
                "\"নতুন রিজার্ভেশন\" ব্যবহার করে বই ও সদস্য খুঁজুন। প্রতিটি রিজার্ভেশনের অগ্রাধিকার থাকে; বেশি অগ্রাধিকারপ্রাপ্ত রিজার্ভেশন আগে পূরণ হয়।",
                "কপি উপলব্ধ হলে রিজার্ভেশন খুলে ফুলফিল চাপুন (এতে ১৪ দিনের ঋণ তৈরি হয়) অথবা বাতিল চাপুন অনুরোধটি সরাতে।",
            ],
        },
        {
            "key": "reports",
            "title": "৮. রিপোর্ট",
            "paragraphs": [
                "রিপোর্ট পৃষ্ঠা থেকে তিনটি PDF রিপোর্ট ডাউনলোড করা যায়।",
                "ইনভেন্টরি রিপোর্টে আইএসবিএন, লেখক, ধারা, কপি, তাকের অবস্থান ও অবস্থাসহ প্রতিটি বই তালিকাভুক্ত থাকে। অতিদেরি ঋণ রিপোর্টে বর্তমানে অতিদেরি হওয়া সকল ঋণ ও জরিমানা থাকে। সদস্য ইতিহাস রিপোর্টে একজন সদস্যের ঋণের ইতিহাস, অপরিশোধিত জরিমানা, রিজার্ভেশন ও অনুমোদিত রিভিউ একসাথে থাকে।",
                "প্রতিটি রিপোর্ট ডাউনলোডের সময় ডাটাবেসের বর্তমান অবস্থা থেকে তৈরি হয় এবং PDF-এর শিরোনামে বাংলাদেশের স্থানীয় সময় (এশিয়া/ঢাকা) অনুযায়ী নির্ভুল তারিখ ও সময় উল্লেখ থাকে। রিপোর্ট অনুমোদিত — রিপোর্ট URL কখনো শেয়ার করবেন না।",
            ],
        },
        {
            "key": "auditLogs",
            "title": "৯. অডিট লগ",
            "paragraphs": [
                "অডিট লগ পৃষ্ঠায় সিস্টেমের প্রতিটি গুরুত্বপূর্ণ কাজ নথিভুক্ত থাকে: তৈরি, হালনাগাদ, মুছে ফেলা, সার্কুলেশন ঘটনা এবং জরিমানা পরিশোধ।",
                "কাজ দিয়ে ফিল্টার করুন, কাজ/এন্টিটি/বিবরণ জুড়ে খুঁজুন এবং ঘটনার পূর্ণ কাঁচা বিবরণ দেখতে একটি সারি খুলুন।",
                "অডিট লগ শুধু পড়ার জন্য। এটি কী কখন করেছে তা চিহ্নিত করতে সাহায্য করে।",
            ],
        },
        {
            "key": "theme",
            "title": "১০. লাইট/ডার্ক মোড",
            "paragraphs": [
                "হেডারের শীর্ষ বারের সূর্য/চাঁদ বাটন ব্যবহার করে লাইট ও ডার্ক মোডের মধ্যে পরিবর্তন করুন।",
                "আপনার পছন্দটি ব্রাউজারে সংরক্ষিত হয় এবং পরের বার প্রতিটি পৃষ্ঠায় প্রযোজ্য হয়।",
            ],
        },
        {
            "key": "language",
            "title": "১১. ইংরেজি/বাংলা ভাষা পরিবর্তন",
            "paragraphs": [
                "হেডারের শীর্ষ বারের ভাষা বাটন দিয়ে পুরো ইন্টারফেসটি ইংরেজি ও বাংলার মধ্যে পরিবর্তন করুন।",
                "পছন্দটি ব্রাউজারে সংরক্ষিত থাকে এবং পরের ভিজিটে মনে রাখা হয়। ভাষা পরিবর্তনে শুধু ইন্টারফেস অনুবাদ হয়; বইয়ের শিরোনাম, সদস্যের নাম ও অন্যান্য সংরক্ষিত তথ্য অপরিবর্তিত থাকে।",
            ],
        },
        {
            "key": "logout",
            "title": "১২. লগআউট",
            "paragraphs": [
                "হেডারের শীর্ষ বারে \"লগআউট\" চাপুন এবং সেশন নিরাপদে শেষ করতে ডায়ালগটি নিশ্চিত করুন।",
                "আপনাকে লগইন পৃষ্ঠায় ফিরিয়ে নেওয়া হবে। শুধু ব্রাউজার ট্যাব বন্ধ করলে সেশন শেষ হয় না, তাই শেয়ার্ড কম্পিউটারে সবসময় লগআউট করুন।",
            ],
        },
    ],
}