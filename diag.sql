SELECT branch, COUNT(*) as development_count FROM developments GROUP BY branch;
SELECT branch, status, COUNT(*) as stand_count FROM stands GROUP BY branch, status;
