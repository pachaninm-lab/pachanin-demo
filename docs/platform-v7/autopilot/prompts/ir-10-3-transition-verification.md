# IR-10.3 transition verification

The transition PR must prove:

- the temporary `.github/workflows/tmp-transition-ir-10-3.yml` file is deleted;
- no workflow in the transition diff writes or pushes directly to `main`;
- only source-of-truth documents and the workflow deletion are changed;
- IR-10.2 is recorded as merged evidence without promoting platform maturity;
- IR-10.3 is the sole active backend authority package;
- IR-10.4 and later gates remain locked;
- Industrial Integration-Ready remains NO-GO.
