export const allExPositions = [
  "ישיבה תמוכה",
  "ישיבה ללא תמיכה",
  "עמידה בבסיס רחב",
  "עמידה בבסיס צר",
  "עמידה על רגל אחת",
  "עמידת טנדם",
  "תוך כדי הליכה",
] as const;

export const allBackgrounds = [
  "רקע לבן",
  "רקע צבעוני",
  "רקע צבעוני+רעשי רקע",
] as const;

export type Position = (typeof allExPositions)[number];
export type Background = (typeof allBackgrounds)[number];
export type Gender = "male" | "female";

type GenderPair = Record<Gender, string>;

const genderTokens = {
  chose: { male: "בחר", female: "בחרי" },
  move: { male: "הזיז", female: "הזיזי" },
  move1: { male: "הניע", female: "הניעי" },
  strait: { male: "הזדקף", female: "הזדקפי" },
  bend: { male: "התכופף", female: "התכופפי" },
  turn: { male: "סובב", female: "סובבי" },
  focus: { male: "התמקד", female: "התמקדי" },
  remember: { male: "זכור", female: "זכרי" },
  closeEyes: { male: "עצום", female: "עיצמי" },
  openEyes: { male: "פקח", female: "פקחי" },
  check: { male: "בדוק", female: "בדקי" },
  repeat: { male: "חזור", female: "חזרי" },
  onYou: { male: "עליך", female: "עלייך" },
  femaleYud: { male: "", female: "י" },
  mark: { male: "סמן", female: "סמני" },
  download: { male: "הורד", female: "הורידי" },
  go: { male: "לך", female: "לכי" },
  youCan: { male: "תוכל", female: "תוכלי" },
} as const satisfies Record<string, GenderPair>;

type GenderToken = keyof typeof genderTokens;

interface ExerciseTemplate {
  exName: string;
  exTextDescriptionTemplate: string;
  exImage: string;
  displayCircle: boolean;
}

export interface ExerciseContent {
  exName: string;
  exTextDescription: string;
  exImage: string;
  displayCircle: boolean;
}

const exerciseTemplates: ExerciseTemplate[] = [
  {
    exName: "VORx1",
    exTextDescriptionTemplate:
      "{{focus}} באיור שיוצג לפניכם ו{{move1}} את ראשך ימינה ושמאלה בקצב מירבי המאפשר ראייה ברורה של פרטי האיור. <br> מטרת התרגול היא לשפר את יכולת מיקוד המבט במהלך תנועות ראש.",
    exImage: "/assets/exercises/vor-x1-x2.png",
    displayCircle: true,
  },
  {
    exName: "VORx2",
    exTextDescriptionTemplate:
      "{{focus}} באיור שיוצג לפניכם ו{{move1}} את ראשך ימינה ושמאלה בקצב מירבי המאפשר ראייה ברורה של פרטי האיור.<br>{{onYou}} להתאים את קצב תנועות הראש <u>לקצב המטרונום</u>.<br>מטרת התרגול היא לשפר את יכולת מיקוד המבט במהלך תנועות ראש.<br>",
    exImage: "/assets/exercises/vor-x1-x2.png",
    displayCircle: true,
  },
  {
    exName: "הביטואציה - אופקי",
    exTextDescriptionTemplate:
      '{{move1}} את ראשך ימינה ושמאלה (תנועת "לא") בקצב שגורם לתחושת סחרחורת בעוצמה מתוך 10.<br>מטרת התרגול היא לעודד את המוח להתגבר על תחושת הסחרחורת בפעילויות היומיומיות, בעזרת חשיפה הדרגתית לתחושת סחרחורת בתנועות ראש.',
    exImage: "/assets/exercises/habituation-horizontal.png",
    displayCircle: false,
  },
  {
    exName: "הביטואציה - אנכי",
    exTextDescriptionTemplate:
      '{{move1}} את ראשך מעלה ומטה (תנועת "כן") בקצב שגורם לתחושת סחרחורת בעוצמה מתוך 10.<br>מטרת התרגול היא לעודד את המוח להתגבר על תחושת הסחרחורת בפעילויות היומיומיות, בעזרת חשיפה הדרגתית לתחושת סחרחורת בתנועות ראש.',
    exImage: "/assets/exercises/habituation-vertical.png",
    displayCircle: false,
  },
  {
    exName: "הביטואציה עם כיפוף גו",
    exTextDescriptionTemplate:
      "{{bend}} מטה ו{{strait}} חזרה בקצב שגורם לתחושת סחרחורת בעוצמה מתוך 10. <br>מטרת התרגול היא לעודד את המוח להתגבר על תחושת הסחרחורת בפעילויות היומיומיות, בעזרת חשיפה הדרגתית לתחושת סחרחורת בתנועות ראש.",
    exImage: "/assets/exercises/habituation-bending.png",
    displayCircle: false,
  },
  {
    exName: "הביטואציה סיבובי",
    exTextDescriptionTemplate:
      "{{turn}} את ראשך בצורה מעגלית ימינה או שמאלה בקצב שגורם לתחושת סחרחורת בעוצמה מתוך 10. <br>ניתן להחליף בין כיווני התנועה בין החזרות. <br>מטרת התרגול היא לעודד את המוח להתגבר על תחושת הסחרחורת בפעילויות היומיומיות, בעזרת חשיפה הדרגתית לתחושת סחרחורת בתנועות ראש.",
    exImage: "/assets/exercises/habituation-circular.png",
    displayCircle: false,
  },
  {
    exName: "Gaze shifting",
    exTextDescriptionTemplate:
      "{{chose}} שתי נקודות ברורות <u>בחדר</u> - האחת מימינך והשנייה משמאלך. {{move}} את <strong>העיניים</strong> אל המטרה <u>מימינך</u>, ואחר כך {{move}} במהירות את <strong>הראש</strong> <u>ימינה</u>, תוך מיקוד מבט על המטרה. <br>{{move}} את <strong>העיניים</strong> אל המטרה <u>משמאלך</u>, ואחר כך {{move}} במהירות את <strong>הראש</strong> <u>שמאלה</u>, תוך מיקוד מבט על המטרה. <br><br>דגשים: <br><ol><li>קצב המטרונום קובע את <u>הזזת העיניים</u> למטרה מימין ואז למטרה משמאל. יש לבצע בקצב המאפשר ראייה ברורה של המטרה.</li><li>תנועת העיניים ותנועת הראש אינן מתבצעות בו זמנית.</li></ol>מטרת התרגול היא לשפר את יכולת מיקוד המבט במהלך תנועות הראש.",
    exImage: "/assets/exercises/gaze-shifting.png",
    displayCircle: false,
  },
  {
    exName: "Imaginary target",
    exTextDescriptionTemplate:
      "{{focus}} באיור שיוצג לפנ{{femaleYud}}יך, <u>{{remember}} את מיקומו ו{{closeEyes}} את עינ{{femaleYud}}יך</u>. {{move1}} את ראשך ימינה, {{openEyes}} עינ{{femaleYud}}ך ו{{check}} אם הצלחת להשאיר את המבט על הנקודה. {{focus}} בנקודה שוב, {{closeEyes}} עינ{{femaleYud}}יך, ו{{repeat}} על התהליך בהנעת ראשך לצד שמאל.<br> מטרת התרגול היא לשפר את יכולת מיקוד המבט בתיאום עם תנועות הראש.",
    exImage: "/assets/exercises/imaginary-target.png",
    displayCircle: true,
  },
  {
    exName: "שינויי כיוון בהליכה",
    exTextDescriptionTemplate:
      "{{go}} לאורך קיר או מסדרון לפי הקצב המושמע. הקצב כולל 4 צעדי הליכה, ובפעימה החמישית {{onYou}} להסתובב בבת אחת לצד ממנו באת. לאחר כ-2 שניות, הקצב יתחיל מחדש, ו{{youCan}} לחזור על התהליך עד חלוף זמן התרגול.<br> מטרת התרגיל היא לעודד את המוח להתגבר על תחושת הסחרחורת ולשפר את שיווי המשקל בשינויי כיוון בהליכה.",
    exImage: "/assets/exercises/direction-change.png",
    displayCircle: false,
  },
];

export function applyGenderToText(template: string, gender: Gender): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    if (!(token in genderTokens)) {
      return "";
    }

    return genderTokens[token as GenderToken][gender];
  });
}

export function getExercises(gender: Gender): ExerciseContent[] {
  return exerciseTemplates.map((exercise) => ({
    exName: exercise.exName,
    exTextDescription: applyGenderToText(
      exercise.exTextDescriptionTemplate,
      gender,
    ),
    exImage: exercise.exImage,
    displayCircle: exercise.displayCircle,
  }));
}
