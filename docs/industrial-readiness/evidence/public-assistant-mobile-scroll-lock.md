# Public assistant mobile scroll lock

Authority commit: `3d8f3f5b3a49e22decd6f2be7233bc28ae500cad`

Scope:

- lock `html` and `body` overflow while the public assistant dialog exists;
- disable background touch scrolling and overscroll chaining;
- preserve scrolling and touch interaction inside the assistant panel;
- keep the rule scoped to the public assistant dialog only.

Acceptance target:

- no page movement behind the modal at 320, 375, 390 and 430 CSS px;
- no iOS rubber-band or viewport drift caused by background scrolling;
- the message list and form remain independently interactive.
