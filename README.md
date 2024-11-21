
# passport-gitlab-ts

GitLab OAuth2 authentication strategy for Passport, written in TypeScript.

## Features

- Easy integration with Passport.js for GitLab authentication.
- Supports customizable GitLab base URL for self-hosted instances.
- Written in TypeScript with full type definitions included.

---

## Installation

Install the package via npm:

```bash
npm install passport-gitlab-ts
```

---

## Usage

### Basic Example

```typescript
import passport from 'passport';
import { GitLabStrategy } from 'passport-gitlab-ts';

passport.use(
  new GitLabStrategy(
    {
      clientID: 'YOUR_GITLAB_CLIENT_ID',
      clientSecret: 'YOUR_GITLAB_CLIENT_SECRET',
      callbackURL: 'http://localhost:3000/auth/gitlab/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      // Use the profile information to find or create a user in your database
      done(null, profile);
    },
  ),
);

// Express route handlers
app.get('/auth/gitlab', passport.authenticate('gitlab'));

app.get(
  '/auth/gitlab/callback',
  passport.authenticate('gitlab', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/');
  },
);
```

---

## Configuration Options

| Option         | Type     | Default              | Description                                   |
|-----------------|----------|----------------------|-----------------------------------------------|
| `clientID`      | `string` | **Required**         | GitLab application client ID.                |
| `clientSecret`  | `string` | **Required**         | GitLab application client secret.            |
| `callbackURL`   | `string` | **Required**         | The URL to which GitLab will redirect after authentication. |
| `baseUrl`       | `string` | `https://gitlab.com` | GitLab instance base URL (for self-hosted).  |
| `scope`         | `string[]` | `['read_user']`    | Permissions your app needs.                  |

---

## Customizing the Strategy

For self-hosted GitLab instances, provide a custom `baseUrl`:

```typescript
new GitLabStrategy(
  {
    clientID: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET',
    callbackURL: 'http://localhost:3000/auth/gitlab/callback',
    baseUrl: 'https://gitlab.example.com',
  },
  (accessToken, refreshToken, profile, done) => {
    done(null, profile);
  },
);
```

---

## Profile Format

The strategy returns a `profile` object with the following structure:

```typescript
interface Profile {
  provider: 'gitlab';
  id: string;
  displayName: string;
  username: string;
  profileUrl: string;
  photos: Array<{ value: string }>;
  emails: Array<{ value: string }>;
  _json: any; // Raw GitLab API response
}
```

---

## Testing

Run the test suite:

```bash
npm test
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/alexander-rudyk/passport-gitlab-ts).
