const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching all profiles...");
    const { data, error } = await supabaseAdmin.from('profiles').select('*');
    if (error) {
        console.error("Error fetching:", error);
    } else {
        console.log("Profiles in database:", JSON.stringify(data, null, 2));
    }
}

run();
