# טיפול בדיווחים

אפל דורשת לטפל בדיווח על תוכן פוגעני תוך 24 שעות. אין התראה אוטומטית, אז צריך להיכנס פעם ביום ל-Supabase ולבדוק.

כל הפקודות כאן מריצים ב-Supabase: **SQL Editor** ← מדביקים ← **Run**.
בכל מקום שכתוב בו `USER_ID` או `LEAGUE_ID`, מחליפים במזהה שמופיע בתוצאה של הפקודה הראשונה.

## 1. לראות דיווחים פתוחים

```sql
select r.id, r.created_at, r.reason,
       coalesce(un.username, l.name) as target,
       r.reported_user_id, r.league_id,
       count(*) over (partition by coalesce(r.reported_user_id::text, r.league_id::text)) as total_reports
from public.content_reports r
left join public.usernames un on un.user_id = r.reported_user_id
left join public.leagues l on l.id = r.league_id
where r.resolved_at is null
order by r.created_at;
```

`reason`: `name` = שם פוגעני, `picture` = תמונה פוגענית, `other` = אחר.

תמונת פרופיל ששלושה אנשים שונים דיווחו עליה מוסתרת מהטבלאות אוטומטית, עד שמסמנים את הדיווחים כמטופלים.

## 2. לטפל

**למחוק תמונת פרופיל פוגענית:**
```sql
update auth.users set raw_user_meta_data = raw_user_meta_data - 'avatar_url'
where id = 'USER_ID';
```

**להחליף שם משתמש פוגעני** (המשתמש יוכל לבחור שם חדש בעריכת פרופיל):
```sql
update public.usernames set username = 'שחקן' || left(user_id::text, 6) where user_id = 'USER_ID';
update auth.users
set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{username}', to_jsonb('שחקן' || left(id::text, 6)))
where id = 'USER_ID';
```

**לנקות שם או תמונה של ליגה:**
```sql
update public.leagues set name = 'ליגה', image_url = null where id = LEAGUE_ID;
```

**לחסום משתמש שמפר את התנאים** (לא יוכל להתחבר יותר):
```sql
update auth.users set banned_until = 'infinity' where id = 'USER_ID';
```

## 3. לסמן כמטופל

```sql
update public.content_reports set resolved_at = now()
where resolved_at is null and (reported_user_id = 'USER_ID' or league_id = LEAGUE_ID);
```
(מוחקים את החלק שלא רלוונטי: `reported_user_id = ...` למשתמש, `league_id = ...` לליגה.)

## להוסיף מילה לסינון

שמות משתמש ושמות ליגה שמכילים מילה מהרשימה נדחים.

```sql
-- anywhere = true: נתפס גם בתוך מילה אחרת. false: רק כמילה שלמה.
insert into public.blocked_words (word, anywhere) values ('מילה', false);
```
