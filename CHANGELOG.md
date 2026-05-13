# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 - Unreleased

### Added
- Pi extension: async stat injection on `session_start`
- CLI: `cover`, `top-tags`, `top-entities`, `hotspots`, `top-mental-models`
- Hindsight REST API client for tags, entities, entity graph, mental models
- Configurable step pipeline with per-section enable/limit/budget
- TTL-based disk cache
- Config precedence: env > `~/.hindsight/stats-config.json` > defaults
- Token-budgeted rendering for context injection
