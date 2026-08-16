# Running VERP locally

```bash
git clone https://github.com/voss-labs/verp.git
cd verp
npm install
npm run dev:setup
npm run dev
```

That is the whole thing. No Neon account, no VOSS client credentials, no
sign-in. Open <http://localhost:3000> and pick who you are from the switcher
beside the VOSS mark in the sidebar.

You need Docker running — [OrbStack](https://orbstack.dev) is lighter than
Docker Desktop on a Mac and works unchanged, since it provides the same
`docker` and `docker compose` commands.

## Why this exists

VERP authenticates through VOSS, the college's identity provider. A contributor
cannot register a VOSS client, so before this the app ran and then redirected
you to a login you had no way to complete. The setup instructions were
unfollowable through no fault of anyone following them.

## What `npm run dev:setup` does

1. Copies `.env.development.example` to `.env.local` if you have no `.env.local`
2. Starts a Postgres container and waits for it to accept connections
3. Pushes the schema, then records the migration files as already applied
4. Seeds a college's worth of mock data

| Command             |                                   |
| ------------------- | --------------------------------- |
| `npm run dev:setup` | the whole thing, from nothing     |
| `npm run dev:seed`  | rewrite the mock data             |
| `npm run dev:down`  | stop the container, keep the data |
| `npm run dev:reset` | destroy the data and start over   |

## The identity switcher

Ten people are seeded, and the switcher makes you one of them. There is no
password because there is no sign-in — the cookie names a persona, and that is
the only thing being faked.

|                | Role        | Scope                                    |
| -------------- | ----------- | ---------------------------------------- |
| Asha Deshpande | Super-admin | the whole institution                    |
| Ravi Kulkarni  | HOD         | EXCS — two classes, cover authority      |
| Sunita Rane    | HOD         | EXTC — nothing in EXCS is visible        |
| Priya Nair     | Coordinator | BE EXCS A — publishes, decides enrolment |
| Mandar Patil   | Teacher     | BE EXCS A — Data Analytics only          |
| Kavita Joshi   | Teacher     | BE EXCS A — Computer Networks only       |
| Imran Shaikh   | Teacher     | BE EXCS B — a different division         |
| Neha Bhosale   | Student     | 23108A0001, has published results        |
| Omkar Sawant   | Student     | 23108A0002, nothing published yet        |
| Rohit Gaikwad  | Unplaced    | authenticated, on no roster              |

### The permissions are real

This is the part worth understanding before you rely on it.

`getSessionUser()` takes four fields from the identity provider — id, name,
email, image — and resolves everything that matters from the database: which
tier you are, which departments and classes you can reach, and your whole
capability set including any override an admin has set. The switcher substitutes
those four fields and nothing else.

So becoming the HOD of EXTC does not _grant_ you EXTC. It makes you a person
whose faculty row says so, and the same queries decide the rest. If you break a
scope rule, this environment shows you — which a mock that returned a
fabricated permission set could not.

Measured on the seeded data, the roster each persona can read:

```
admin          1736     every student
hod-excs        509     EXCS only
hod-extc        503     EXTC only
coordinator      62     one class
teacher-dav      62     one class
student          62     their own class
unplaced          0
```

## What the mock data contains

Roughly 1,700 students across three departments and all four year-cohorts, so
filters, search, pagination and the scoped queries behave the way they will in
front of a real roster. An N+1 that is invisible against a dozen rows is obvious
against a thousand.

**BE EXCS A** is wired end to end, and is where the rules become visible:

- `EC33T` published — the student persona has a result and an SGPI to read
- `EC34T` ISA only — provisional, "In progress", 0 of 62 complete
- `EC35T` no teacher — top of the attention inbox
- `EC36P` an untouched lab
- today's register deliberately not taken, so there is work waiting
- one pending enrolment request for the coordinator to decide
- one student below the 75% attendance rule, so the warning has something to say

Two teachers hold different subjects on that one class on purpose: it is what
makes "that subject is allocated to another teacher" reachable rather than
theoretical.

## This cannot reach production

An authentication bypass is worth being paranoid about, so there are three
independent locks and any one of them is enough.

1. **`NODE_ENV`** must not be `production`. Both `next build` and `next start`
   set it, so a deployed bundle fails the check regardless of configuration.
2. **`VERP_DEV_AUTH`** must be exactly `"1"`. Nothing sets it by accident;
   `"true"`, `"yes"` and `"0"` are all rejected, and there are tests for that.
3. **`next.config.ts` refuses to build or start** when a production build and
   the flag are both present. The artifact cannot be produced.

Verified rather than asserted — a production build with the flag set:

```
Error: VERP_DEV_AUTH is set for a production build. It bypasses sign-in and
must never be present in a deployed environment — unset it and rebuild.
```

and a production build with the flag absent, handed a valid persona cookie:

```
admin        -> 307 /login
student      -> 307 /login
coordinator  -> 307 /login
```

The seeder has its own lock: it refuses to run against any host that is not
local, because everything it does begins by deleting rows.

## Building locally

`npm run build` refuses while `VERP_DEV_AUTH` is set — the guard cannot tell a
laptop's production build from a deployable one, and it should not try, because
the artifact is the same either way. To check that a change compiles:

```bash
VERP_DEV_AUTH= npm run build
```

## A note on `drizzle-kit push`

`push` makes a database match `src/db/schema`, and to add a unique constraint to
a table that already has rows it will **truncate that table**. It asks first —
but the question is a prompt, `--force` does not answer it, and inside a script
nobody sees it.

That is worth knowing before you point any `db:` command at a database you care
about. It is also why `dev:setup` refuses to run against anything but the local
container, and why the seeder refuses any host that is not local.

## Working against the real thing

Nothing stops you. Put your Neon and VOSS credentials in `.env.local` and drop
`VERP_DEV_AUTH`, and the switcher disappears — the dev identity falls through to
the real login whenever it cannot resolve a persona, so the two paths coexist
without a build flag.

## Notes

- The local driver is `node-postgres`; production is Neon over HTTP. The one
  behavioural difference is that node-postgres supports transactions and
  neon-http does not, so **do not write code that assumes them** — it will work
  on your machine and fail in production. The codebase is transaction-free for
  this reason.
- The container listens on **5433**, not 5432, to stay clear of a Postgres you
  may already be running.
- The switcher is deliberately ugly — dashed border, flask icon — so a
  screenshot from a contributor's laptop is never mistaken for the real
  application.
