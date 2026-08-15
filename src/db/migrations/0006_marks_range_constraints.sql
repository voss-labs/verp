-- Marks must be non-negative. The application now validates against each
-- course's own maxima, which the database cannot see from this table -- but
-- "not negative" is true of every component of every course, and it is the
-- half that turns a silently wrong average into a rejected write.
--
-- Applied as NOT VALID first so an existing bad row cannot block the deploy,
-- then validated: the constraint binds all new writes immediately either way.

ALTER TABLE marks
  ADD CONSTRAINT marks_isa_non_negative CHECK (isa IS NULL OR isa >= 0) NOT VALID;
ALTER TABLE marks
  ADD CONSTRAINT marks_mse1_non_negative CHECK (mse1 IS NULL OR mse1 >= 0) NOT VALID;
ALTER TABLE marks
  ADD CONSTRAINT marks_mse2_non_negative CHECK (mse2 IS NULL OR mse2 >= 0) NOT VALID;
ALTER TABLE marks
  ADD CONSTRAINT marks_ese_non_negative CHECK (ese IS NULL OR ese >= 0) NOT VALID;

ALTER TABLE marks VALIDATE CONSTRAINT marks_isa_non_negative;
ALTER TABLE marks VALIDATE CONSTRAINT marks_mse1_non_negative;
ALTER TABLE marks VALIDATE CONSTRAINT marks_mse2_non_negative;
ALTER TABLE marks VALIDATE CONSTRAINT marks_ese_non_negative;
