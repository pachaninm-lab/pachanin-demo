# Owner package B — GPU model host requirements

Status: **owner decision required.** No GPU host is provisioned. This document states what to
order and why, and marks clearly which numbers are measured, which are derived, and which can only
come from the benchmark this host exists to run.

Program: #2726, issue #2972. Blocks backlog item **C.03** (GPU Qwen Q8_0 profile at concurrency
1/2/4/8 with VRAM and one-hour soak), which with C.01/C.02 blocks **C.04** primary model admission.

---

## 1. Why a GPU host at all

The CPU path already works. On 2026-07-25 the read-only preview ran Qwen3-8B Q4_K_M on the
dedicated CPU model host and returned verified RU/EN/ZH responses — run
[30170949129](https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30170949129) on exact-main
`b78b169a21e1`, published result `READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY`.

So this is not about whether the model runs. It is about two things the CPU host cannot give:

1. **Q8_0.** The master specification pins GPU inference to Q8_0, a materially more accurate
   quantization than the Q4_K_M used on CPU. The quality gates in stage E are measured against the
   model that will actually serve; measuring Q4_K_M and admitting Q8_0 would be measuring one thing
   and shipping another.
2. **Concurrency.** C.03 requires a profile at concurrency 1, 2, 4 and 8. The CPU preview runs at
   `parallel_requests: 1` by design. Serving several role cabinets at once is the question the
   benchmark has to answer, and it cannot be answered on hardware that serves one request at a time.

---

## 2. Sizing

### 2.1 Model footprint — derived, and stated as a derivation

The Q4_K_M artifact is **5 027 784 032 bytes** (≈ 4.68 GiB). That number is verified: it is the size
of the GGUF produced by the accepted conversion run `29810648430` and checked by digest.

Q8_0 stores roughly 8.5 bits per weight against Q4_K_M's roughly 4.83, a ratio of about 1.76. That
puts the Q8_0 artifact at approximately **8.8 GB (≈ 8.2 GiB)**.

This is arithmetic on a verified input, not a measurement. The real figure comes from the conversion
run that produces the Q8_0 artifact, and the sizing below carries enough headroom that a 10 % error
in this estimate changes nothing.

### 2.2 VRAM

| Component | At 4096 context | Note |
|---|---|---|
| Q8_0 weights | ≈ 8.2 GiB | derived, §2.1 |
| KV cache, concurrency 8 | ≈ 4–5 GiB | Qwen3-8B uses grouped-query attention, so KV is far smaller than the head count suggests. Exact value must be read from `llama-server` at load. |
| CUDA context, buffers, fragmentation | ≈ 1–2 GiB | |
| **Total at concurrency 8** | **≈ 14–15 GiB** | |

**Minimum: 16 GB VRAM.** Fits concurrency 8 at 4096 context with little room to spare.

**Recommended: 24 GB VRAM.** Comfortable at concurrency 8, leaves room for longer contexts, and
leaves the option of holding the Mistral-7B fallback resident on the same card instead of paying a
model-swap stall on every failover.

Do not order 12 GB. It fits the weights and then runs out of KV cache exactly when concurrency
rises, which is the one condition the benchmark exists to measure.

### 2.3 The rest of the host

| Resource | Minimum | Recommended | Why |
|---|---|---|---|
| GPU | 16 GB VRAM, compute capability ≥ 7.5 | 24 GB VRAM, Ampere or newer | §2.2. Compute capability ≥ 7.5 for practical INT8/FP16 throughput in llama.cpp CUDA builds. |
| System RAM | 32 GB | 64 GB | The bundle is staged and digest-verified in RAM-backed paths before load; the CPU host already enforces a 12 GB RSS guard for the smaller Q4_K_M. |
| vCPU | 8 | 16 | Tokenization, sampling and the HTTP layer are CPU-side and become the bottleneck at concurrency 8 on a small vCPU count. |
| System disk | 100 GB SSD | 200 GB NVMe | OS, CUDA toolkit, llama.cpp build. |
| Model disk | 150 GB | 250 GB | Both models, both quantizations, plus one conversion run's intermediates. The bundle total is 48 995 504 288 bytes and conversion needs roughly twice the largest artifact in scratch. |
| Network | 1 Gbit/s | 1 Gbit/s | Bundle restore from immutable storage moves ~49 GB. At 1 Gbit/s that is ~7 minutes; at 100 Mbit/s it is over an hour, which turns every host rebuild into an outage. |
| OS | Ubuntu 24.04 LTS x86-64 | same | Matches the existing dedicated CPU model host, so one runbook covers both. |
| Region | Russian contour | same | Infrastructure policy. |

### 2.4 Configuration that must match the CPU host

These are not defaults to be revisited on the new host — they are the invariants the preview runtime
already enforces, and the benchmark is only comparable if they hold:

- listener bound to `127.0.0.1` only, never a routable address;
- dedicated unprivileged user `tai-model`, workspace under `/srv/tai-models`;
- context 4096, deterministic generation (`temperature 0`, `top_p 1`, `seed 42`);
- a whole-process-tree RSS guard, fail-closed, sized for this host's RAM;
- no model bytes, raw prompts or raw responses leave the host; evidence is digests only.

---

## 3. Cost

**I am not putting a price in this document.** Russian GPU hosting prices move, differ sharply
between hourly and monthly commitments, and I cannot reach provider price lists from this
environment — the egress proxy refuses `reg.ru` and the search index returned nothing
provider-specific. A number invented here would look like a budget and be a guess.

What to ask a provider for, so the quotes are comparable:

> Dedicated GPU server or GPU VM, Russian region.
> GPU: 24 GB VRAM, Ampere generation or newer (RTX 4090, RTX A5000, L4, A100 or equivalent).
> 16 vCPU, 64 GB RAM, 200 GB NVMe system, 250 GB additional storage, 1 Gbit/s.
> Ubuntu 24.04 LTS. Root or sudo access. Private networking with no public inbound.
> Quote monthly, and hourly if available.

Ask each provider for both. The benchmark itself needs roughly a day of GPU time — C.03 requires a
one-hour soak at each of four concurrency levels plus setup and repeats — so if hourly billing is
available, **the benchmark can be run without committing to a monthly contract at all**. That is
worth checking before signing anything: the admission decision needs the measurement, not the
long-term capacity.

---

## 4. What the benchmark will measure

Stated here so the host is ordered against the right target, and so that nothing in this document is
mistaken for a result. **None of these numbers exist yet.**

| Metric | Concurrency | Required by |
|---|---|---|
| Tokens per second, prefill and decode | 1, 2, 4, 8 | C.03 |
| Time to first token | 1, 2, 4, 8 | C.03 |
| Peak VRAM | 1, 2, 4, 8 | C.03 |
| Stability across a one-hour soak | at the chosen operating point | C.03 |
| Operating cost per 1000 tokens | derived from measured throughput and the quoted price | C.01 parity |

The CPU preview's observed rate — roughly 9–10 tokens per second on Q4_K_M at concurrency 1 — is the
baseline the GPU profile will be compared against. It is a smoke-test observation from run
30170949129, not a benchmark: the preview ran three short prompts, not a measured profile, and
C.01 remains `BLOCKED`.

---

## 5. Sequencing

The GPU host is **not** blocked by owner package A, and package A is not blocked by this one. They
can be procured in parallel.

They do converge before the benchmark can run: C.03 needs a Q8_0 artifact on the GPU host, and the
governed path to get one there is a restore from immutable bundle storage (B.06 → B.07). A GPU host
that arrives before the bucket exists is not idle — CUDA toolchain, llama.cpp CUDA build, the
`tai-model` user, the RSS guard and the loopback listener can all be prepared and verified against
the existing runbook while storage is being settled.

---

## 6. What this package does not claim

- No GPU host exists, is ordered, or has been priced.
- No GPU throughput, latency or VRAM figure has been measured. Every number in §2 is either a
  verified artifact size or arithmetic derived from one, and is labelled as such.
- C.03 remains **BLOCKED**. Model admission remains `PENDING_ADMISSION`. Benchmark status remains
  `PENDING_BENCHMARK`. Production operational status remains `NOT_ATTESTED`.
