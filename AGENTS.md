# Helm.Warning Implementation Guide

## CONTEXT
This is a NAVAREA maritime warning pipeline site. We're refactoring from a
cluttered single-page to a clean public site + admin console.

## REFERENCE FILES
- `index.html` - APPROVED public site design (Map/Data Bank/Sources)
- `admin.html` - APPROVED admin console design (5 sub-tabs + login)

## RULES
1. Never break the ingestion pipeline or atomic publishing
2. Public page contains ZERO admin code
3. All writes use authenticated Supabase client
4. RLS enabled on all tables with proper policies
5. No demo credentials in shipped code
6. Design tokens ONLY (no hardcoded colors/fonts)

## DESIGN TOKENS (from reference files)
Colors: --critical:#dc2626; --high:#ea580c; --active:#059669; 
        --verified:#0d9488; --neutral:#64748b
Type: H1 600/28px; H2 600/20px; body 400/14px
Spacing: 4/8/16/24/40/64px
