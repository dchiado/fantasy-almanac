"""Pure season logic: parsed ESPN data in, plain data out.

Nothing in this package calls AWS or ESPN, or imports anything that does, so it
runs locally against saved responses (see tests/ and scripts/ at the repo root).
utils loads the data; engine works on it.
"""
