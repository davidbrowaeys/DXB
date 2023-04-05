trigger {{triggerName}} on {{sobject}} (before insert, before update) {
	new {{className}}().execute();
}