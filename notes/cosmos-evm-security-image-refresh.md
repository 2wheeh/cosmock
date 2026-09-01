# Cosmos EVM security image refresh

Research cutoff: **2026-09-01**. Sources are upstream/chain-owned GitHub repositories, official release pages, official Actions runs, and container-registry manifests. This note evaluates the in-progress worktree at the cutoff; it does not modify production code or config.

## Decision summary

The August incident is [GHSA-7g4w-cg88-2cq2](https://github.com/cosmos/evm/security/advisories/GHSA-7g4w-cg88-2cq2), a critical EVM `StateDB` balance-underflow issue. Affected upstream ranges are `<0.6.2` and `>=0.7.0 <0.7.2`; the patched lines begin at `v0.6.2` and `v0.7.2`. The [official post-mortem](https://github.com/cosmos/security/blob/main/communications/cosmos_evm_GHSA-7g4w-cg88-2cq2_post_mortem.md) says the exploit affected all Cosmos EVM decimal configurations, was used against six networks, and requires a coordinated binary upgrade. Disabling only the staking precompile is not an adequate replacement.

Exact upstream fix points:

- Main fix: [PR #1176](https://github.com/cosmos/evm/pull/1176), merge `264aa70f18f4217b0354855a0c056e19c2f51b51`.
- `release/v0.6.x` backport: [PR #1253](https://github.com/cosmos/evm/pull/1253), merge `82b3ef6c80887f5b3fb95b1f6ecb519f06202a7e`.
- `release/v0.7.x` backport: [PR #1254](https://github.com/cosmos/evm/pull/1254), merge `0182da198f1f84dc0e4c937fca5e5f175d1be986`.
- Patched release commits: [`v0.6.2` → `3cac4284…`](https://github.com/cosmos/evm/commit/3cac428417e8bd1ca457d7fdffb3722e3addb228) and [`v0.7.2` → `ef11f63c…`](https://github.com/cosmos/evm/commit/ef11f63c087b4c859b1e8eddc823f7cf2113a50a). Both [v0.6.2](https://github.com/cosmos/evm/releases/tag/v0.6.2) and [v0.7.2](https://github.com/cosmos/evm/releases/tag/v0.7.2) are explicitly state-breaking security releases.

An earlier 2026 critical issue, [ASA-2026-002 / GHSA-54gx-3cgr-7mfm](https://github.com/cosmos/evm/security/advisories/GHSA-54gx-3cgr-7mfm), affected the ICS20 precompile and was fixed in upstream `v0.6.0`. The urgent August refresh is driven by the newer underflow advisory, whose safe floor is `v0.6.2`/`v0.7.2`.

| Starskiff instance | Baseline before this branch | Safe target as of cutoff | Official container status | Worktree assessment |
|---|---|---|---|---|
| `evmd` | Starskiff-built upstream `v0.7.1` | upstream [`v0.7.2`, commit `ef11f63c…`](https://github.com/cosmos/evm/releases/tag/v0.7.2) | Cosmos EVM does not publish a usable versioned `evmd` image; Starskiff must build it | Published for amd64/arm64 and pinned to manifest `sha256:05780885…` |
| `xplad` | official GHCR `v1.10.0` | XPLA [`v1.12.0`, commit `f187194c…`](https://github.com/xpladev/xpla/releases/tag/v1.12.0) | **No safe upstream image exists.** Official `v1.11.5` and `v1.12.0` GHCR builds failed | Handled in a separate stacked XPLA PR; wrapper already published for amd64/arm64 as manifest `sha256:7c59d87f…` |
| `mantra` | official `v8.2.0` | official [`v8.4.0`, commit `5c08d7bd…`](https://github.com/MANTRA-Chain/mantrachain/releases/tag/v8.4.0) | `ghcr.io/mantra-chain/mantrachain:v8.4.0`, multi-arch digest `sha256:0b3ea13db9252a4b7fec04a4cb1b6514cf974158ceb654c22f29d9383a5810f7` | Updated to `v8.4.0`; correct |
| `xrplevm` | official `v10.0.2` | official [`v10.2.0`, commit `22c4dd05…`](https://github.com/xrplevm/node/releases/tag/v10.2.0) | `peersyst/exrp:v10.2.0`, amd64-only image digest `sha256:a7544a2bba6b4dd08990d42c264439748dd0d20dd0fca5b0253ed8ec209fa79e` | Updated to `v10.2.0`; correct |

## Chain-specific evidence and caveats

### evmd

The previous `config/images.json` source, upstream `v0.7.1`, falls directly in the advisory's vulnerable `>=0.7.0 <0.7.2` range. The correct build input is `cosmos/evm@v0.7.2`, exact commit `ef11f63c087b4c859b1e8eddc823f7cf2113a50a`.

Upstream has no versioned official image or release binary to pin. Its image tooling builds a local `cosmos/evmd` name in the [repository Makefile](https://github.com/cosmos/evm/blob/main/contrib/images/Makefile), and the [compose file](https://github.com/cosmos/evm/blob/main/docker-compose.yml) consumes that local name. Therefore Starskiff's existing exact-source build and post-publish digest pin remains the appropriate model.

### XPLA: `v1.11.5` does not contain the underflow fix

This was an important correction during implementation: an initial `v1.11.5` target was superseded by `v1.12.0` after checking the private fork's exact fix commits.

- The old `v1.10.0` [`go.mod`](https://github.com/xpladev/xpla/blob/v1.10.0/go.mod) replaces Cosmos EVM with `xpladev/evm v0.6.0-xpla.1`, predating the August fix.
- XPLA [`v1.11.5`](https://github.com/xpladev/xpla/releases/tag/v1.11.5) is labeled “EVM security patch,” but its replacement module is `v0.6.0-xpla.4-august-2026-hotfix`. Authenticated source inspection resolves that tag to `0989b300c80e90c32f648b15bdb138c92e59d875`, whose change is **discard partial writes when Commit fails**.
- XPLA [`v1.12.0`](https://github.com/xpladev/xpla/releases/tag/v1.12.0) advances to `v0.6.0-xpla.5-august-2026-hotfix`. Its additional commit is `82d374a4b7e87367954736b5f75bb299211caa6e`, titled **guard balance subtraction underflow**. XPLA [PR #227](https://github.com/xpladev/xpla/pull/227) explicitly identifies it as a Cosmos EVM security patch and chain-fork change. This is the release that covers GHSA-7g4w's underflow.

The downstream EVM repository referenced by [`v1.12.0`'s `go.mod`](https://github.com/xpladev/xpla/blob/v1.12.0/go.mod) is private. Consequently XPLA's official [v1.12.0 container workflow](https://github.com/xpladev/xpla/actions/runs/32795650488) failed because the builder could not fetch `github.com/delight-labs/evm-priv-jul2026`; registry inspection confirms `ghcr.io/xpladev/xpla:v1.12.0` does not exist. The same is true for `v1.11.5`. The newest successfully published XPLA GHCR image is `v1.11.4`, which is also pre-fix and unsafe for this advisory.

XPLA does publish usable official `v1.12.0` Linux binaries with GitHub-recorded digests, so a thin Starskiff wrapper image can still be built without private-source access:

- [arm64 tarball](https://github.com/xpladev/xpla/releases/download/v1.12.0/xpla_v1.12.0_Linux_arm64.tar.gz): `sha256:dec981fbe883651aca8bc31e9be987724b2b49a30d7e0696bea19deef582d3c1`
- [x86_64 tarball](https://github.com/xpladev/xpla/releases/download/v1.12.0/xpla_v1.12.0_Linux_x86_64.tar.gz): `sha256:fe4864c00815cf84e98873345bd83a0fd3ed22330db6e10d5b4c21d380eab1ee`

Uncertainty: the exact `xpla.4`/`xpla.5` downstream commits were resolved with authenticated access to a private chain-owned dependency and are not independently visible to anonymous users. Public evidence still supports the same conclusion: the public release/PR describes `v1.12.0` as the balance guard and chain-fork release, and the official build log exposes the private dependency tag that it could not fetch.

### MANTRA

The previous `v8.2.0` [`go.mod`](https://github.com/MANTRA-Chain/mantrachain/blob/v8.2.0/go.mod) used `MANTRA-Chain/evm v0.6.0-v8-mantra-3`, below the safe upstream floor. MANTRA was the first chain in the August incident to report exploitation. The official post-mortem records that mainnet resumed on `v8.4.0`.

`v8.4.0`'s [`go.mod`](https://github.com/MANTRA-Chain/mantrachain/blob/v8.4.0/go.mod) replaces Cosmos EVM with `MANTRA-Chain/evm v0.6.2-v8-mantra-1`; that fork tag resolves to [`8611b98f…`](https://github.com/MANTRA-Chain/evm/commit/8611b98fd23399f532e4a423240ead3a9eb90add). The official [GHCR package](https://github.com/MANTRA-Chain/mantrachain/pkgs/container/mantrachain) publishes `v8.4.0` for both amd64 and arm64 under the manifest digest recorded above.

### XRPL EVM

The previous `v10.0.2` [`go.mod`](https://github.com/xrplevm/node/blob/v10.0.2/go.mod) used a `v0.6.0`-based fork. The `v10.2.0` [release notes](https://github.com/xrplevm/node/releases/tag/v10.2.0) explicitly update it to `v0.6.2-august-2026-hotfix-xrplevm.1`; the matching [`go.mod`](https://github.com/xrplevm/node/blob/v10.2.0/go.mod) confirms the pin.

Do not select the numerically newer `v11.1.0`: its [`go.mod`](https://github.com/xrplevm/node/blob/v11.1.0/go.mod) still uses `v0.6.1-xrplevm.1`, within the advisory's vulnerable range. `v10.2.0` is the newest official security-fixed release at the cutoff. Registry inspection confirms `peersyst/exrp:v10.2.0`; despite GitHub providing an arm64 binary asset, the container tag itself contains only a linux/amd64 runtime manifest (plus an attestation manifest), so Starskiff's amd64/emulation warning remains accurate. The official registry tag can be checked on [Docker Hub](https://hub.docker.com/r/peersyst/exrp/tags?name=v10.2.0).

## Non-EVM instances

`gaiad v27.5.0`, `simd` on the Cosmos SDK `v0.53` line, and `wasmd v0.61.14` do not import `github.com/cosmos/evm` in their release `go.mod` files ([Gaia](https://github.com/cosmos/gaia/blob/v27.5.0/go.mod), [Cosmos SDK](https://github.com/cosmos/cosmos-sdk/blob/v0.53.0/go.mod), [wasmd](https://github.com/CosmWasm/wasmd/blob/v0.61.14/go.mod)). They are not affected by this Cosmos EVM-specific advisory, so this incident alone is not a reason to change those image defaults.

## Recommended implementation outcome

1. Keep `evmd` at `v0.7.2` and its immutable Starskiff GHCR manifest digest.
2. In the separate XPLA PR, keep the wrapper at **`v1.12.0`**, using the two official release assets and GitHub-recorded SHA-256 values above. `v1.11.5` leaves the balance underflow unresolved.
3. Keep MANTRA at official `v8.4.0` and XRPL EVM at official `v10.2.0`.
4. Do not fold Gaia/simd/wasmd upgrades into this security PR; review their freshness separately if desired.
