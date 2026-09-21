-- Apply as MySQL root after migrations. No database-wide runtime grant.
GRANT SELECT, INSERT, UPDATE ON ltas.municipalities TO 'ltas_app'@'%';
GRANT SELECT, INSERT, UPDATE ON ltas.users TO 'ltas_app'@'%';
GRANT SELECT, INSERT, UPDATE ON ltas.grant_requests TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.user_roles TO 'ltas_app'@'%';
GRANT UPDATE (revokedAt, revision) ON ltas.user_roles TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.council_terms TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.persons TO 'ltas_app'@'%';
GRANT SELECT, INSERT, UPDATE ON ltas.committees TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.committee_members TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.audit_logs TO 'ltas_app'@'%';
GRANT SELECT, UPDATE ON ltas.audit_cursors TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.outbox_events TO 'ltas_app'@'%';
GRANT SELECT, INSERT ON ltas.idempotency_records TO 'ltas_app'@'%';
GRANT SELECT, UPDATE ON ltas.outbox_events TO 'ltas_worker'@'%';
GRANT SELECT, INSERT, UPDATE ON ltas.consumer_receipts TO 'ltas_worker'@'%';
-- Neither runtime identity may UPDATE/DELETE audit_logs or access keycloak.*.
