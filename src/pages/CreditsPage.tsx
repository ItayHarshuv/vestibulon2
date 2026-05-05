export function CreditsPage() {
  return (
    <main dir="rtl" className="flex min-h-screen justify-center bg-white px-6 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-gray-50 p-8 text-right shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">אודות</h1>

        <div className="mt-6 space-y-6 text-lg leading-8 text-gray-800">
          <p>
            מטרת היישומון היא לסייע למטופלים הסובלים מסחרחורות בעקבות בעיה
            וסטיבולרית, יש להתמיד בתוכנית התרגול כפי שנקבעה על ידי הצוות הרפואי.
          </p>

          <p>
            פיתוח וזכויות יוצרים:
            <br />
            יישומון זה פותח על ידי לירן קלדרון, שלי לוי-צדק, עזריאל קפלן ויואב
            גימון, בשיתוף פעולה בין אוניברסיטת בן-גוריון, המרכז הרפואי שיבא
            ואוניברסיטת חיפה. כל הזכויות שמורות ©.
          </p>

          <p>
            כתיבת קוד:
            <br />
            איתי הר-שוב
          </p>
        </div>
      </div>
    </main>
  );
}
