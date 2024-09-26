<!-- src/routes/profile/+page.svelte -->
<script>
  export let user;
</script>

<h2>Welcome，{user.username}</h2>
<p>Your points balance：{user.points}</p>
