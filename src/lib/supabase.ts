import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zbyyndatevwoxumhlckh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXluZGF0ZXZ3b3h1bWhsY2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzc5NjQsImV4cCI6MjA5NTk1Mzk2NH0.fI1Y9G398Ex3zkYxG2Fhh2vdYcrzATJgEvjed9lHups';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
